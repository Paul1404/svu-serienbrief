"""
CSV Validator for SV 1945 Untereuerheim Member Data
Validates address fields and flags edge cases for manual review.
"""

from typing import List, Dict, Tuple
from loguru import logger


class MemberRecord:
    """Represents a single member record from the CSV."""
    
    def __init__(self, row: Dict[str, str], row_number: int):
        self.row_number = row_number
        self.vorname = (row.get('Vorname') or '').strip()
        self.nachname = (row.get('Nachname') or '').strip()
        self.mitgl_nr = (row.get('Mitgl.Nr.') or '').strip()
        self.strasse = (row.get('Strasse') or '').strip()
        self.plz = (row.get('PLZ') or '').strip()
        self.ort = (row.get('Ort') or '').strip()
        self.email = (row.get('E-Mail') or '').strip()
        self.telefon = (row.get('Telefon') or '').strip()
        self.geschlecht = (row.get('Geschlecht') or '').strip()
    
    def to_dict(self) -> Dict[str, str]:
        """Convert record to dictionary for database insertion."""
        return {
            'mitgl_nr': self.mitgl_nr or None,
            'vorname': self.vorname,
            'nachname': self.nachname,
            'strasse': self.strasse,
            'plz': self.plz,
            'ort': self.ort,
            'email': self.email or None,
            'telefon': self.telefon or None,
            'geschlecht': self.geschlecht or None,
        }


class ValidationResult:
    """Result of validating a member record."""
    
    def __init__(self, record: MemberRecord, is_valid: bool, reasons: List[str]):
        self.record = record
        self.is_valid = is_valid
        self.reasons = reasons


def validate_record(row: Dict[str, str], row_number: int) -> ValidationResult:
    """
    Validate a single member record.
    
    Args:
        row: Dictionary containing CSV row data
        row_number: Row number in the CSV file (for logging)
    
    Returns:
        ValidationResult with validation status and any issues found
    """
    record = MemberRecord(row, row_number)
    reasons = []
    
    # Check for required name fields
    if not record.vorname:
        reasons.append("Missing first name (Vorname)")
    if not record.nachname:
        reasons.append("Missing last name (Nachname)")
    
    # Check for complete address (required for mailing)
    if not record.strasse:
        reasons.append("Missing street address (Strasse)")
    if not record.plz:
        reasons.append("Missing postal code (PLZ)")
    if not record.ort:
        reasons.append("Missing city (Ort)")
    
    # A record is valid if it has no validation issues
    is_valid = len(reasons) == 0
    
    return ValidationResult(record, is_valid, reasons)


def validate_csv_data(df) -> Tuple[List[MemberRecord], List[Tuple[MemberRecord, List[str]]]]:
    """
    Validate all records from a pandas DataFrame.
    
    Args:
        df: Pandas DataFrame containing CSV data
    
    Returns:
        Tuple of (valid_records, edge_cases)
        - valid_records: List of MemberRecord objects ready for processing
        - edge_cases: List of (MemberRecord, reasons) tuples for manual review
    """
    valid_records = []
    edge_cases = []
    
    logger.info(f"Validating {len(df)} records from CSV")
    
    for idx, row in df.iterrows():
        result = validate_record(row.to_dict(), idx + 2)  # +2 because pandas is 0-indexed and CSV has header
        
        if result.is_valid:
            valid_records.append(result.record)
        else:
            edge_cases.append((result.record, result.reasons))
            logger.warning(
                f"Row {result.record.row_number}: Edge case - {result.record.vorname} {result.record.nachname} - "
                f"Issues: {', '.join(result.reasons)}"
            )
    
    logger.info(f"Validation complete: {len(valid_records)} valid, {len(edge_cases)} edge cases")
    
    return valid_records, edge_cases
