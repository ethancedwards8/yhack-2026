import requests
import os
from pathlib import Path
from dotenv import load_dotenv


ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=ENV_PATH)
BACKEND_API = os.getenv("BACKEND_API")

if not BACKEND_API:
    raise RuntimeError("no backend api")


def get_updated_elo(bill_id : int, user_id : int) -> float: 
    user_response = requests.get(f'{BACKEND_API}/user/{user_id}')
    bill_response = requests.get(f'{BACKEND_API}/bill/{bill_id}')
    user_response.raise_for_status()
    bill_response.raise_for_status()

    user = user_response.json()
    bill = bill_response.json()

    elo = bill['elo']
    bill_bias = bill['bias']
    user_bias = user['bias']

    return elo_alg(elo=elo, bill_bias=bill_bias, user_bias=user_bias)


# this function blah blah blah
def elo_alg(elo : float, bill_bias : str, user_bias : float) -> float:
    bias_text = bill_bias.strip().lower()

    if bias_text not in ("left", "right"):
        raise ValueError("bill_bias must be 'left' or 'right'")
    if not 0.0 <= user_bias <= 1.0:
        raise ValueError("user_bias must be between 0.0 and 1.0")

    bill_side = 0.0 if bias_text == "left" else 1.0
    
    distance = abs(user_bias - bill_side)
    min_boost = 4.0
    max_boost = 24.0
    boost = min_boost + ((max_boost - min_boost) * distance)

    return elo + boost
