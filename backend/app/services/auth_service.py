import random
import string
from typing import Dict, Tuple

# In-memory store for active OTPs
# Format: { "user@email.com": "123456" }
ACTIVE_OTPS: Dict[str, str] = {}

def generate_otp(length: int = 6) -> str:
    """Generates a random numeric OTP."""
    return ''.join(random.choices(string.digits, k=length))

def send_otp(identifier: str, otp_type: str) -> Tuple[bool, str]:
    """
    Generates an OTP and stores it.
    Returns (success_status, otp_code).
    
    NOTE FOR HACKATHON: 
    We return the code directly so the frontend can display it in 'Demo Mode'.
    In production, this would trigger Twilio/SendGrid API calls.
    """
    code = generate_otp()
    
    # Store the code associated with the user identifier
    ACTIVE_OTPS[identifier] = code
    
    # Print to backend terminal for debugging
    print(f"\n🔐 AUTH DEBUG: Generated OTP for {identifier} ({otp_type}): {code}\n")
    
    return True, code

def verify_otp(identifier: str, code: str) -> bool:
    """
    Checks if the provided code matches the stored one.
    Deletes the code upon successful verification to prevent reuse.
    """
    stored_code = ACTIVE_OTPS.get(identifier)
    
    if not stored_code:
        return False
        
    if stored_code == code:
        # Success: Remove from active list
        del ACTIVE_OTPS[identifier]
        return True
        
    return False