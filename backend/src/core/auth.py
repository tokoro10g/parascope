import os
import re
from typing import Optional

from fastapi import Header, HTTPException


def get_current_user(x_parascope_user: Optional[str] = Header(None, alias="X-Parascope-User")) -> Optional[str]:
    if not x_parascope_user:
        return None
    
    regex_pattern = os.getenv("USERNAME_REGEX")
    if regex_pattern:
        if not re.match(regex_pattern, x_parascope_user):
            raise HTTPException(status_code=400, detail="Invalid username format")
            
    return x_parascope_user
