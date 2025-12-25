"""
PDF Letter Generator for SV 1945 Untereuerheim e.V.
Creates personalized verification letters with QR codes using ReportLab.
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.platypus import Image
from loguru import logger
from pathlib import Path
import qrcode
import io
from typing import Dict


class LetterGenerator:
    """Generates DIN A4 format verification letters with QR codes."""
    
    # DIN 5008 standard measurements for German business letters
    LOGO_X = 25 * mm
    LOGO_Y = A4[1] - 45 * mm
    LOGO_HEIGHT = 30 * mm
    
    SENDER_X = 25 * mm
    SENDER_Y = A4[1] - 45 * mm
    
    RECIPIENT_X = 25 * mm
    RECIPIENT_Y = A4[1] - 90 * mm
    
    BODY_X = 25 * mm
    BODY_Y = A4[1] - 140 * mm
    BODY_WIDTH = A4[0] - 50 * mm
    
    QR_SIZE = 40 * mm  # 4cm x 4cm
    QR_X = A4[0] - 35 * mm - QR_SIZE  # Bottom right positioning
    QR_Y = 35 * mm  # Moved up to avoid collision with footer
    
    FOOTER_Y = 15 * mm
    
    def __init__(self, verification_base_url: str, logo_path: Path = None):
        """
        Initialize the letter generator.
        
        Args:
            verification_base_url: Base URL for verification portal (e.g., https://svu-mitgliedschaft.untereuerheim.com)
            logo_path: Optional path to club logo image file
        """
        self.verification_base_url = verification_base_url
        self.logo_path = logo_path
        logger.info(f"Letter generator initialized with base URL: {verification_base_url}")
        if logo_path:
            logger.info(f"Using logo: {logo_path}")
    
    def _generate_qr_code(self, url: str) -> Image:
        """
        Generate QR code image for the verification URL.
        
        Args:
            url: Full verification URL to encode
        
        Returns:
            ReportLab Image object
        """
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,  # 15% error correction
            box_size=10,
            border=4,
        )
        qr.add_data(url)
        qr.make(fit=True)
        
        qr_img = qr.make_image(fill_color="black", back_color="white")
        
        # Convert PIL image to bytes
        img_buffer = io.BytesIO()
        qr_img.save(img_buffer, format='PNG')
        img_buffer.seek(0)
        
        return Image(img_buffer, width=self.QR_SIZE, height=self.QR_SIZE)
    
    def _draw_logo(self, c: canvas.Canvas):
        """Draw club logo in the header."""
        if self.logo_path and self.logo_path.exists():
            try:
                logo = Image(str(self.logo_path), height=self.LOGO_HEIGHT)
                # Calculate width to maintain aspect ratio
                aspect = logo.imageWidth / logo.imageHeight
                logo.drawWidth = self.LOGO_HEIGHT * aspect
                logo.drawHeight = self.LOGO_HEIGHT
                
                # Position logo at top right
                logo_x = A4[0] - 35 * mm - logo.drawWidth
                logo.drawOn(c, logo_x, self.LOGO_Y - self.LOGO_HEIGHT)
            except Exception as e:
                logger.warning(f"Could not load logo: {e}")
    
    def _draw_sender_address(self, c: canvas.Canvas):
        """Draw sender address in the header."""
        c.setFont("Helvetica", 8)
        c.drawString(self.SENDER_X, self.SENDER_Y, 
                    "SV 1945 Untereuerheim e.V. · Triebweg 9 · 97508 Grettstadt/Untereuerheim")
    
    def _draw_recipient_address(self, c: canvas.Canvas, member: Dict[str, str]):
        """Draw recipient address block."""
        c.setFont("Helvetica-Bold", 11)
        
        # Handle multiple names (e.g., "Elke und Stefan")
        full_name = f"{member['vorname']} {member['nachname']}"
        c.drawString(self.RECIPIENT_X, self.RECIPIENT_Y, full_name)
        
        c.setFont("Helvetica", 11)
        c.drawString(self.RECIPIENT_X, self.RECIPIENT_Y - 14, member['strasse'])
        c.drawString(self.RECIPIENT_X, self.RECIPIENT_Y - 28, f"{member['plz']} {member['ort']}")
    
    def _draw_body(self, c: canvas.Canvas, member: Dict[str, str]):
        """Draw letter body text."""
        y = self.BODY_Y
        
        # Salutation - handle multiple names appropriately
        c.setFont("Helvetica", 11)
        if " und " in member['vorname'].lower() or " u. " in member['vorname'].lower():
            salutation = f"Liebe Mitglieder,"
        elif member.get('geschlecht') == 'WEIBLICH':
            salutation = f"Liebe {member['vorname'].split()[0]},"
        elif member.get('geschlecht') == 'MÄNNLICH':
            salutation = f"Lieber {member['vorname'].split()[0]},"
        else:
            salutation = f"Liebe/r {member['vorname'].split()[0]},"
        
        c.drawString(self.BODY_X, y, salutation)
        y -= 20
        
        # Main body text
        body_lines = [
            "im Rahmen unserer regelmäßigen Datenpflege möchten wir sicherstellen, dass wir",
            "Sie auch weiterhin über wichtige Termine, Veranstaltungen und Neuigkeiten aus",
            "dem SVU-Leben informieren können.",
            "",
            "Bitte überprüfen Sie Ihre unten angegebenen Kontaktdaten und aktualisieren Sie",
            "diese bei Bedarf über unser Mitgliederportal. Dies dauert nur wenige Minuten",
            "und hilft uns, Sie optimal zu erreichen.",
            "",
            "So funktioniert es:",
            "1. Scannen Sie einfach den QR-Code mit Ihrem Smartphone",
            "2. Überprüfen Sie Ihre Daten im Portal",
            "3. Nehmen Sie bei Bedarf Änderungen vor und speichern Sie diese",
            "",
            "Der QR-Code befindet sich unten rechts auf diesem Schreiben.",
            "",
            "Vielen Dank für Ihre Unterstützung und Ihr Engagement im SV 1945 Untereuerheim!",
        ]
        
        c.setFont("Helvetica", 10)
        for line in body_lines:
            c.drawString(self.BODY_X, y, line)
            y -= 14
        
        # Closing
        y -= 10
        c.setFont("Helvetica", 10)
        c.drawString(self.BODY_X, y, "Mit sportlichen Grüßen")
        y -= 20
        c.setFont("Helvetica-Bold", 10)
        c.drawString(self.BODY_X, y, "Die Vorstandschaft")
    
    def _draw_footer(self, c: canvas.Canvas):
        """Draw footer with contact information."""
        c.setFont("Helvetica", 8)
        c.setFillColor(colors.grey)
        
        footer_text = "SV 1945 Untereuerheim e.V. · info@sv-untereuerheim.de · Tel.: 09729/432"
        text_width = c.stringWidth(footer_text, "Helvetica", 8)
        c.drawString((A4[0] - text_width) / 2, self.FOOTER_Y, footer_text)
        
        c.setFillColor(colors.black)
    
    def _draw_qr_code(self, c: canvas.Canvas, token: str):
        """Draw QR code with instructions and URL."""
        verification_url = f"{self.verification_base_url}/verify/{token}"
        
        # Generate and draw QR code
        qr_image = self._generate_qr_code(verification_url)
        qr_image.drawOn(c, self.QR_X, self.QR_Y)
        
        # Add instruction text below QR code
        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(colors.grey)
        instruction = "Scannen Sie diesen Code"
        text_width = c.stringWidth(instruction, "Helvetica-Bold", 8)
        c.drawString(self.QR_X + (self.QR_SIZE - text_width) / 2, self.QR_Y - 12, instruction)
        
        # Add URL below instruction - use smaller font and wrap to fit
        c.setFont("Helvetica", 5)
        
        # Split URL into manageable lines that fit within QR code width
        base_url = self.verification_base_url.replace("https://", "")
        
        # Line 1: Domain
        line1 = base_url
        # Line 2-3: /verify/ and token split if needed
        token_part = f"/verify/{token}"
        
        # Calculate if token fits on one line
        max_width = self.QR_SIZE
        token_width = c.stringWidth(token_part, "Helvetica", 5)
        
        y_pos = self.QR_Y - 22
        
        # Draw domain
        line1_width = c.stringWidth(line1, "Helvetica", 5)
        c.drawString(self.QR_X + (self.QR_SIZE - line1_width) / 2, y_pos, line1)
        y_pos -= 7
        
        # Draw token - split into chunks if needed
        if token_width <= max_width:
            # Fits on one line
            c.drawString(self.QR_X + (self.QR_SIZE - token_width) / 2, y_pos, token_part)
        else:
            # Split into two lines
            line2 = token_part[:30]
            line3 = token_part[30:]
            
            line2_width = c.stringWidth(line2, "Helvetica", 5)
            c.drawString(self.QR_X + (self.QR_SIZE - line2_width) / 2, y_pos, line2)
            y_pos -= 7
            
            line3_width = c.stringWidth(line3, "Helvetica", 5)
            c.drawString(self.QR_X + (self.QR_SIZE - line3_width) / 2, y_pos, line3)
        
        c.setFillColor(colors.black)
    
    def generate_letter(self, member: Dict[str, str], token: str, output_path: Path) -> bool:
        """
        Generate a complete verification letter PDF.
        
        Args:
            member: Dictionary with member data (vorname, nachname, strasse, plz, ort, etc.)
            token: Unique verification token for this member
            output_path: Path where the PDF should be saved
        
        Returns:
            True if successful, False otherwise
        """
        try:
            # Create output directory if it doesn't exist
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Create PDF canvas
            c = canvas.Canvas(str(output_path), pagesize=A4)
            
            # Draw all letter components
            self._draw_logo(c)
            self._draw_sender_address(c)
            self._draw_recipient_address(c, member)
            self._draw_body(c, member)
            self._draw_qr_code(c, token)
            self._draw_footer(c)
            
            # Save PDF
            c.save()
            
            logger.debug(f"Generated letter: {output_path}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to generate letter for {member['vorname']} {member['nachname']}: {e}")
            return False
