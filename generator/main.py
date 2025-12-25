"""
Main Generator Script for SV 1945 Untereuerheim Member Verification System
Reads CSV data, generates secure tokens, stores in database, and creates PDF letters.
"""

import os
import sys
import secrets
from pathlib import Path
from typing import List, Tuple
import pandas as pd
import psycopg2
from psycopg2.extras import execute_batch
from dotenv import load_dotenv
from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from validator import validate_csv_data, MemberRecord
from pdf_generator import LetterGenerator


# Configure logging
logger.remove()  # Remove default handler
logger.add(
    sys.stderr,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <level>{message}</level>",
    level="INFO"
)


class MemberVerificationGenerator:
    """Main generator orchestrating the entire letter creation process."""
    
    def __init__(self, database_url: str, verification_url: str, csv_path: Path, output_dir: Path):
        """
        Initialize the generator.
        
        Args:
            database_url: PostgreSQL connection string
            verification_url: Base URL for the verification portal
            csv_path: Path to the input CSV file
            output_dir: Directory where PDFs will be saved
        """
        self.database_url = database_url
        self.verification_url = verification_url
        self.csv_path = csv_path
        self.output_dir = output_dir
        self.output_edge_cases_dir = output_dir / "edge-cases"
        
        # Find logo path
        logo_path = Path(__file__).parent.parent / "media" / "logo_svu-241x300.png"
        self.letter_generator = LetterGenerator(verification_url, logo_path)
        
        # Create output directories
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.output_edge_cases_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"Generator initialized")
        logger.info(f"CSV path: {csv_path}")
        logger.info(f"Output directory: {output_dir}")
        logger.info(f"Edge cases directory: {self.output_edge_cases_dir}")
    
    def _setup_database(self):
        """
        Set up database schema if tables don't exist.
        Reads and executes schema.sql file.
        """
        logger.info("Checking database setup...")
        
        try:
            conn = self._get_db_connection()
            cursor = conn.cursor()
            
            # Check if members table exists
            cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'members'
                );
            """)
            
            table_exists = cursor.fetchone()[0]
            
            if table_exists:
                logger.info("Database tables already exist, skipping setup")
                conn.close()
                return
            
            logger.info("Tables not found, creating database schema...")
            
            # Read schema.sql file
            schema_path = Path(__file__).parent / "schema.sql"
            if not schema_path.exists():
                logger.error(f"Schema file not found: {schema_path}")
                raise FileNotFoundError(f"Schema file missing: {schema_path}")
            
            with open(schema_path, 'r', encoding='utf-8') as f:
                schema_sql = f.read()
            
            # Execute schema
            cursor.execute(schema_sql)
            conn.commit()
            
            logger.info("✓ Database schema created successfully")
            conn.close()
            
        except Exception as e:
            logger.error(f"Database setup failed: {e}")
            raise
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((psycopg2.OperationalError, psycopg2.InterfaceError)),
        reraise=True
    )
    def _get_db_connection(self):
        """Get database connection with retry logic."""
        logger.info("Connecting to database...")
        return psycopg2.connect(self.database_url)
    
    def _generate_token(self) -> str:
        """Generate a cryptographically secure 32-byte URL-safe token."""
        return secrets.token_urlsafe(32)
    
    def _read_csv(self) -> pd.DataFrame:
        """
        Read and parse the member CSV file.
        
        Returns:
            Pandas DataFrame with member data
        """
        logger.info(f"Reading CSV file: {self.csv_path}")
        
        try:
            df = pd.read_csv(
                self.csv_path,
                delimiter=';',
                encoding='cp1252',  # German encoding for umlauts
                dtype=str,  # Read all columns as strings to preserve data
                keep_default_na=False  # Don't convert empty strings to NaN
            )
            
            logger.info(f"Successfully read {len(df)} records from CSV")
            return df
            
        except FileNotFoundError:
            logger.error(f"CSV file not found: {self.csv_path}")
            raise
        except Exception as e:
            logger.error(f"Error reading CSV file: {e}")
            raise
    
    def _upsert_members_batch(self, conn, members_with_tokens: List[Tuple[MemberRecord, str]]):
        """
        Upsert all members to database in a single transaction.
        Uses ON CONFLICT to regenerate/overwrite existing tokens.
        
        Args:
            conn: Database connection
            members_with_tokens: List of (MemberRecord, token) tuples
        """
        cursor = conn.cursor()
        
        # Build the INSERT ... ON CONFLICT query
        # We use mitgl_nr + vorname + nachname as the natural key for detecting duplicates
        # If a match is found, we UPDATE with new data and regenerate the token
        upsert_query = """
            INSERT INTO members (
                token, mitgl_nr, vorname, nachname, strasse, plz, ort, 
                email, telefon, geschlecht
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            ON CONFLICT ON CONSTRAINT members_token_key
            DO NOTHING;
            
            -- For duplicate detection by name, we'll use a separate check
            -- This is a simplified approach - in production you might want a unique index on (vorname, nachname, plz)
        """
        
        # Since we want to regenerate tokens on each run, we'll use a simpler approach:
        # Delete all existing records and insert fresh ones
        logger.info("Clearing existing member records (regenerate mode)")
        cursor.execute("DELETE FROM members")
        deleted_count = cursor.rowcount
        logger.info(f"Deleted {deleted_count} existing records")
        
        # Prepare data for batch insert
        insert_query = """
            INSERT INTO members (
                token, mitgl_nr, vorname, nachname, strasse, plz, ort,
                email, telefon, geschlecht
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        data_batch = []
        for member, token in members_with_tokens:
            data_batch.append((
                token,
                member.mitgl_nr or None,
                member.vorname,
                member.nachname,
                member.strasse,
                member.plz,
                member.ort,
                member.email or None,
                member.telefon or None,
                member.geschlecht or None
            ))
        
        # Execute batch insert
        execute_batch(cursor, insert_query, data_batch, page_size=100)
        
        conn.commit()
        logger.info(f"Successfully inserted {len(data_batch)} records into database")
    
    def _generate_pdf_for_member(
        self, 
        member: MemberRecord, 
        token: str, 
        output_subdir: Path,
        is_edge_case: bool = False
    ) -> bool:
        """
        Generate PDF letter for a single member.
        
        Args:
            member: Member record
            token: Verification token
            output_subdir: Directory to save the PDF
            is_edge_case: Whether this is an edge case (for logging)
        
        Returns:
            True if successful, False otherwise
        """
        # Create safe filename
        safe_name = f"{member.nachname}_{member.vorname}".replace(" ", "_")
        safe_name = "".join(c for c in safe_name if c.isalnum() or c in ('_', '-'))
        filename = f"{safe_name}.pdf"
        output_path = output_subdir / filename
        
        # Generate the letter
        member_dict = member.to_dict()
        success = self.letter_generator.generate_letter(member_dict, token, output_path)
        
        if not success:
            logger.error(f"Failed to generate PDF for {member.vorname} {member.nachname}")
            raise Exception(f"PDF generation failed for {member.vorname} {member.nachname}")
        
        return success
    
    def run(self):
        """Execute the complete generation process."""
        logger.info("=" * 80)
        logger.info("Starting Member Verification Letter Generation")
        logger.info("=" * 80)
        
        try:
            # Step 0: Setup database if needed
            self._setup_database()
            
            # Step 1: Read CSV
            df = self._read_csv()
            
            # Step 2: Validate data
            valid_records, edge_cases = validate_csv_data(df)
            
            # Step 3: Generate tokens for all records
            logger.info("Generating secure tokens...")
            valid_with_tokens = [(record, self._generate_token()) for record in valid_records]
            edge_with_tokens = [(record, self._generate_token()) for record, _ in edge_cases]
            
            # Step 4: Connect to database and upsert all records in one transaction
            logger.info("Connecting to database...")
            conn = self._get_db_connection()
            
            try:
                # Combine valid and edge case records for database insertion
                all_records_with_tokens = valid_with_tokens + edge_with_tokens
                logger.info(f"Upserting {len(all_records_with_tokens)} records to database...")
                self._upsert_members_batch(conn, all_records_with_tokens)
                
            finally:
                conn.close()
                logger.info("Database connection closed")
            
            # Step 5: Generate PDFs for valid records
            logger.info(f"Generating {len(valid_with_tokens)} letters for valid records...")
            valid_success = 0
            for member, token in valid_with_tokens:
                if self._generate_pdf_for_member(member, token, self.output_dir):
                    valid_success += 1
            
            # Step 6: Generate PDFs for edge cases
            logger.info(f"Generating {len(edge_with_tokens)} letters for edge cases...")
            edge_success = 0
            for (member, reasons), (_, token) in zip(edge_cases, edge_with_tokens):
                if self._generate_pdf_for_member(member, token, self.output_edge_cases_dir, is_edge_case=True):
                    edge_success += 1
            
            # Step 7: Summary
            logger.info("=" * 80)
            logger.info("Generation Complete!")
            logger.info("=" * 80)
            logger.info(f"Total records processed: {len(df)}")
            logger.info(f"Valid records: {len(valid_records)} (PDFs: {valid_success})")
            logger.info(f"Edge cases: {len(edge_cases)} (PDFs: {edge_success})")
            logger.info(f"Output directory: {self.output_dir}")
            logger.info(f"Edge cases directory: {self.output_edge_cases_dir}")
            logger.info("=" * 80)
            
            return True
            
        except Exception as e:
            logger.error(f"Generation failed: {e}")
            logger.exception("Full traceback:")
            return False


def main():
    """Main entry point."""
    # Load environment variables
    load_dotenv()
    
    database_url = os.getenv('DATABASE_URL')
    verification_url = os.getenv('VERIFICATION_URL')
    
    if not database_url:
        logger.error("DATABASE_URL environment variable is not set")
        logger.info("Please create a .env file with DATABASE_URL and VERIFICATION_URL")
        sys.exit(1)
    
    if not verification_url:
        logger.error("VERIFICATION_URL environment variable is not set")
        sys.exit(1)
    
    # Set up paths
    project_root = Path(__file__).parent.parent
    csv_path = project_root / "linear-in" / "Export.csv"
    output_dir = project_root / "output"
    
    # Create and run generator
    generator = MemberVerificationGenerator(
        database_url=database_url,
        verification_url=verification_url,
        csv_path=csv_path,
        output_dir=output_dir
    )
    
    success = generator.run()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
