#!/usr/bin/env python3
"""
Import member data directly from MySQL SQL dump into PostgreSQL database.
Robust parser for complex MySQL INSERT statements with proper tokenization.
"""

import os
import re
import secrets
import psycopg2
from pathlib import Path
from dotenv import load_dotenv
from loguru import logger
from typing import List, Dict, Optional, Tuple
from enum import Enum

# Load environment variables
load_dotenv()

# Configure logger
logger.remove()
logger.add(
    lambda msg: print(msg, end=""),
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <level>{message}</level>\n",
    level="INFO"
)


class TokenType(Enum):
    """SQL token types."""
    LPAREN = "("
    RPAREN = ")"
    COMMA = ","
    STRING = "STRING"
    NUMBER = "NUMBER"
    NULL = "NULL"
    BINARY = "BINARY"


class Token:
    """SQL token."""
    def __init__(self, type: TokenType, value: any):
        self.type = type
        self.value = value


class MySQLParser:
    """Tokenizer and parser for MySQL INSERT statements."""
    
    def __init__(self, sql: str):
        self.sql = sql
        self.pos = 0
        self.length = len(sql)
        
    def peek(self, offset: int = 0) -> Optional[str]:
        """Peek at character without advancing."""
        pos = self.pos + offset
        if pos < self.length:
            return self.sql[pos]
        return None
        
    def advance(self, count: int = 1) -> str:
        """Advance position and return characters."""
        result = self.sql[self.pos:self.pos + count]
        self.pos += count
        return result
        
    def skip_whitespace(self):
        """Skip whitespace characters."""
        while self.pos < self.length and self.sql[self.pos] in ' \t\n\r':
            self.pos += 1
            
    def read_string(self) -> str:
        """Read a quoted string value."""
        # Skip opening quote
        self.advance()
        value = ""
        
        while self.pos < self.length:
            char = self.peek()
            
            if char == '\\':
                # Escape sequence
                self.advance()
                next_char = self.peek()
                if next_char == 'n':
                    value += '\n'
                    self.advance()
                elif next_char == 'r':
                    value += '\r'
                    self.advance()
                elif next_char == 't':
                    value += '\t'
                    self.advance()
                elif next_char == '\\':
                    value += '\\'
                    self.advance()
                elif next_char == "'":
                    value += "'"
                    self.advance()
                elif next_char == '"':
                    value += '"'
                    self.advance()
                elif next_char == '0':
                    value += '\0'
                    self.advance()
                else:
                    # Keep the backslash
                    value += char
            elif char == "'":
                # Check for escaped quote ('' in MySQL)
                if self.peek(1) == "'":
                    value += "'"
                    self.advance(2)
                else:
                    # End of string
                    self.advance()
                    break
            else:
                value += char
                self.advance()
                
        return value
        
    def read_number(self) -> str:
        """Read a numeric value."""
        value = ""
        while self.pos < self.length:
            char = self.peek()
            if char in '0123456789.-+eE':
                value += char
                self.advance()
            else:
                break
        return value
        
    def read_keyword(self) -> str:
        """Read a keyword (NULL, _binary, etc.)."""
        value = ""
        while self.pos < self.length:
            char = self.peek()
            if char.isalnum() or char == '_':
                value += char
                self.advance()
            else:
                break
        return value
        
    def tokenize(self) -> List[Token]:
        """Tokenize the SQL string into tokens."""
        tokens = []
        
        while self.pos < self.length:
            self.skip_whitespace()
            
            if self.pos >= self.length:
                break
                
            char = self.peek()
            
            if char == '(':
                tokens.append(Token(TokenType.LPAREN, '('))
                self.advance()
            elif char == ')':
                tokens.append(Token(TokenType.RPAREN, ')'))
                self.advance()
            elif char == ',':
                tokens.append(Token(TokenType.COMMA, ','))
                self.advance()
            elif char == "'":
                value = self.read_string()
                tokens.append(Token(TokenType.STRING, value))
            elif char in '0123456789-':
                value = self.read_number()
                tokens.append(Token(TokenType.NUMBER, value))
            elif char == 'N' and self.sql[self.pos:self.pos+4] == 'NULL':
                self.advance(4)
                tokens.append(Token(TokenType.NULL, None))
            elif char == '_' and self.sql[self.pos:self.pos+7] == '_binary':
                # Skip binary data entirely
                self.advance(7)
                # Skip the binary string literal
                self.skip_whitespace()
                if self.peek() == "'":
                    self.read_string()
                tokens.append(Token(TokenType.BINARY, None))
            else:
                # Unknown character, try to read as keyword
                keyword = self.read_keyword()
                if keyword == 'NULL':
                    tokens.append(Token(TokenType.NULL, None))
                elif keyword.startswith('_'):
                    tokens.append(Token(TokenType.BINARY, None))
                else:
                    # Treat as string
                    tokens.append(Token(TokenType.STRING, keyword))
                    
        return tokens
        
    def parse_records(self, tokens: List[Token]) -> List[List[any]]:
        """Parse tokens into records (list of lists)."""
        records = []
        current_record = []
        depth = 0
        i = 0
        
        while i < len(tokens):
            token = tokens[i]
            
            if token.type == TokenType.LPAREN:
                if depth == 0:
                    # Start of new record
                    current_record = []
                depth += 1
            elif token.type == TokenType.RPAREN:
                depth -= 1
                if depth == 0:
                    # End of record
                    if current_record:
                        records.append(current_record)
                    current_record = []
            elif token.type == TokenType.COMMA:
                # Comma separates fields at depth 1, records at depth 0
                pass
            elif depth > 0:
                # We're inside a record, add the value
                if token.type == TokenType.STRING:
                    current_record.append(token.value)
                elif token.type == TokenType.NUMBER:
                    current_record.append(token.value)
                elif token.type in (TokenType.NULL, TokenType.BINARY):
                    current_record.append(None)
                    
            i += 1
            
        return records


class SQLImporter:
    """Import data from MySQL SQL dump into PostgreSQL."""
    
    def __init__(self, sql_file: str, database_url: str):
        self.sql_file = Path(sql_file)
        self.database_url = database_url
        self.conn = None
        self.cursor = None
        self.column_map = {}
        
    def connect_db(self):
        """Connect to PostgreSQL database."""
        logger.info(f"Connecting to PostgreSQL database...")
        self.conn = psycopg2.connect(self.database_url)
        self.cursor = self.conn.cursor()
        logger.success("Database connection established")
        
    def close_db(self):
        """Close database connection."""
        if self.cursor:
            self.cursor.close()
        if self.conn:
            self.conn.close()
        logger.info("Database connection closed")
        
    def generate_token(self) -> str:
        """Generate a secure random token."""
        return secrets.token_urlsafe(32)
        
    def extract_column_names(self, content: str) -> Dict[str, int]:
        """Extract column names and positions from CREATE TABLE statement."""
        logger.info("Extracting column names from CREATE TABLE...")
        
        # Find CREATE TABLE `adresse` section
        pattern = r"CREATE TABLE `adresse` \((.*?)\) ENGINE"
        match = re.search(pattern, content, re.DOTALL)
        
        if not match:
            logger.warning("Could not extract column names, using defaults")
            return {}
            
        table_def = match.group(1)
        
        # Parse column definitions
        columns = {}
        position = 0
        
        # Split by lines, each line is a column or constraint
        lines = table_def.strip().split('\n')
        
        for line in lines:
            line = line.strip()
            if not line or line.startswith('PRIMARY KEY') or line.startswith('KEY'):
                continue
                
            # Extract column name (first word after backticks)
            col_match = re.match(r'`(\w+)`', line)
            if col_match:
                col_name = col_match.group(1)
                columns[col_name] = position
                position += 1
                
        logger.info(f"Found {len(columns)} columns in adresse table")
        return columns
        
    def extract_adresse_data(self) -> Tuple[List[List[any]], Dict[str, int]]:
        """Extract INSERT statements from adresse table."""
        logger.info(f"Reading SQL dump from {self.sql_file}...")
        
        with open(self.sql_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Extract column names first
        columns = self.extract_column_names(content)
        
        # Find the INSERT INTO `adresse` VALUES statement
        pattern = r"INSERT INTO `adresse` VALUES (.+?);"
        match = re.search(pattern, content, re.DOTALL)
        
        if not match:
            logger.error("Could not find INSERT INTO `adresse` VALUES in SQL dump")
            return [], columns
            
        values_string = match.group(1)
        logger.info(f"Found INSERT statement ({len(values_string)} characters), parsing...")
        
        # Parse using the tokenizer
        parser = MySQLParser(values_string)
        tokens = parser.tokenize()
        logger.info(f"Tokenized into {len(tokens)} tokens")
        
        records = parser.parse_records(tokens)
        logger.success(f"Parsed {len(records)} records from SQL dump")
        
        return records, columns
        
    def get_field(self, record: List, col_name: str, columns: Dict[str, int]) -> Optional[str]:
        """Get field value by column name."""
        if col_name not in columns:
            return None
        idx = columns[col_name]
        if idx >= len(record):
            return None
        value = record[idx]
        if value is None:
            return None
        return str(value).strip() if value else None
        
    def map_to_schema(self, record: List, columns: Dict[str, int]) -> Optional[Dict]:
        """Map MySQL record to PostgreSQL schema with extended fields."""
        if not columns:
            logger.warning("No column map available, skipping record")
            return None
            
        # Basic personal information
        mitgl_nr = self.get_field(record, 'MITGLNR', columns)
        vorname = self.get_field(record, 'Vorname', columns)
        nachname = self.get_field(record, 'Nachname', columns)
        anrede = self.get_field(record, 'Anrede', columns)
        
        # Address information
        strasse = self.get_field(record, 'Strasse', columns)
        plz = self.get_field(record, 'PLZ', columns)
        ort = self.get_field(record, 'Ort', columns)
        landname = self.get_field(record, 'Landname', columns)
        
        # Contact information - try multiple phone fields
        telefon1 = self.get_field(record, 'Telefon1', columns)
        telefon2 = self.get_field(record, 'Telefon2', columns)
        telefon4 = self.get_field(record, 'Telefon4', columns)
        telefon5 = self.get_field(record, 'Telefon5', columns)
        telefon6 = self.get_field(record, 'Telefon6', columns)
        telefon7 = self.get_field(record, 'Telefon7', columns)
        vorwahl = self.get_field(record, 'Vorwahl', columns)
        fax = self.get_field(record, 'Fax', columns)
        
        # Consolidate phone numbers (prioritize mobile, then landline)
        telefon = None
        for phone in [telefon5, telefon6, telefon7, telefon1, telefon2, telefon4]:
            if phone:
                telefon = phone
                break
        
        # Email - try multiple field names
        email = None
        for field in ['EMailName', 'Telefon3', 'EmailKIH', 'EMail', 'Email', 'email', 'E_Mail']:
            if email := self.get_field(record, field, columns):
                if email and '@' in email:  # Validate it's actually an email
                    break
                else:
                    email = None
        
        # Banking information (SEPA)
        iban = None
        for field in ['IBAN1', 'IBAN', 'iban', 'Konto1']:
            if iban := self.get_field(record, field, columns):
                if iban and len(iban) > 5:  # Basic validation
                    break
                else:
                    iban = None
        
        bic = None
        for field in ['BIC', 'bic', 'SWIFT']:
            if bic := self.get_field(record, field, columns):
                break
                
        bank = None
        for field in ['Bank1', 'Bank', 'bank']:
            if bank := self.get_field(record, field, columns):
                break
                
        kontoinhaber = self.get_field(record, 'AbwKontoInh', columns)
        
        # Dates
        geburtsdatum = self.get_field(record, 'Geburtsdatum', columns)
        eintritt = self.get_field(record, 'Eintritt', columns)
        austritt = self.get_field(record, 'Austritt', columns)
        
        # Status and category fields
        aktiv = self.get_field(record, 'Aktiv', columns)
        betreung = self.get_field(record, 'Betreung', columns)  # Department/section
        
        # Geschlecht from Anrede
        geschlecht = None
        if anrede:
            if 'Herr' in anrede:
                geschlecht = 'm'
            elif 'Frau' in anrede:
                geschlecht = 'w'
                
        # Validate required fields
        if not all([vorname, nachname, strasse, plz, ort]):
            return None
            
        return {
            # Basic identification
            'mitgl_nr': mitgl_nr,
            'anrede': anrede,
            'vorname': vorname,
            'nachname': nachname,
            'geschlecht': geschlecht,
            
            # Address
            'strasse': strasse,
            'plz': plz,
            'ort': ort,
            'land': landname,
            
            # Contact
            'telefon': telefon,
            'telefon2': telefon2,
            'fax': fax,
            'email': email,
            
            # Banking
            'iban': iban,
            'bic': bic,
            'bank': bank,
            'kontoinhaber': kontoinhaber,
            
            # Dates
            'geburtsdatum': geburtsdatum,
            'eintritt': eintritt,
            'austritt': austritt,
            
            # Status
            'aktiv': aktiv,
            'abteilung': betreung
        }
        
    def import_data(self):
        """Main import process."""
        try:
            self.connect_db()
            
            # Extract data from SQL dump
            records, columns = self.extract_adresse_data()
            
            if not records:
                logger.error("No records found in SQL dump")
                return
                
            logger.info(f"Processing {len(records)} records...")
            
            # Clear existing data
            logger.warning("Clearing existing members table...")
            self.cursor.execute("DELETE FROM members")
            self.conn.commit()
            
            # Process each record
            valid_count = 0
            skipped_count = 0
            error_details = []
            
            for i, record in enumerate(records, 1):
                try:
                    member_data = self.map_to_schema(record, columns)
                    
                    if not member_data:
                        skipped_count += 1
                        continue
                        
                    # Generate token
                    token = self.generate_token()
                    
                    # Insert into database
                    self.cursor.execute("""
                        INSERT INTO members (
                            token, mitgl_nr, anrede, vorname, nachname, geschlecht,
                            strasse, plz, ort, land,
                            telefon, telefon2, fax, email,
                            iban, bic, bank, kontoinhaber,
                            geburtsdatum, eintritt, austritt,
                            aktiv, abteilung,
                            created_at
                        ) VALUES (
                            %s, %s, %s, %s, %s, %s,
                            %s, %s, %s, %s,
                            %s, %s, %s, %s,
                            %s, %s, %s, %s,
                            %s, %s, %s,
                            %s, %s,
                            NOW()
                        )
                    """, (
                        token,
                        member_data['mitgl_nr'],
                        member_data['anrede'],
                        member_data['vorname'],
                        member_data['nachname'],
                        member_data['geschlecht'],
                        member_data['strasse'],
                        member_data['plz'],
                        member_data['ort'],
                        member_data['land'],
                        member_data['telefon'],
                        member_data['telefon2'],
                        member_data['fax'],
                        member_data['email'],
                        member_data['iban'],
                        member_data['bic'],
                        member_data['bank'],
                        member_data['kontoinhaber'],
                        member_data['geburtsdatum'],
                        member_data['eintritt'],
                        member_data['austritt'],
                        member_data['aktiv'],
                        member_data['abteilung']
                    ))
                    valid_count += 1
                    
                    if valid_count % 50 == 0:
                        logger.info(f"Imported {valid_count} members...")
                        self.conn.commit()  # Commit in batches
                        
                except Exception as e:
                    error_msg = f"Record {i}: {str(e)}"
                    if len(error_details) < 5:
                        error_details.append(error_msg)
                    skipped_count += 1
                    continue
                    
            # Final commit
            self.conn.commit()
            
            logger.success(f"Import complete!")
            logger.info(f"  ✓ Imported: {valid_count} members")
            logger.info(f"  ✗ Skipped: {skipped_count} records")
            
            if error_details:
                logger.warning("Sample errors:")
                for err in error_details:
                    logger.warning(f"  {err}")
            
        except Exception as e:
            logger.error(f"Import failed: {e}")
            import traceback
            logger.error(traceback.format_exc())
            if self.conn:
                self.conn.rollback()
            raise
        finally:
            self.close_db()


def main():
    """Run the import."""
    # Configuration
    sql_file = Path(__file__).parent.parent / "linear-in" / "datesicherung.sql"
    database_url = os.getenv("DATABASE_URL")
    
    if not database_url:
        logger.error("DATABASE_URL not set in .env file")
        return
        
    if not sql_file.exists():
        logger.error(f"SQL dump file not found: {sql_file}")
        return
        
    logger.info("Starting SQL import...")
    logger.info(f"Source: {sql_file}")
    logger.info(f"Target: PostgreSQL database")
    
    importer = SQLImporter(sql_file, database_url)
    importer.import_data()


if __name__ == "__main__":
    main()
