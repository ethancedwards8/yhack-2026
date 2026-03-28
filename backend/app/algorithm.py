import requests
import os
from pathlib import Path
from dotenv import load_dotenv


ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=ENV_PATH)
BACKEND_API = os.getenv("BACKEND_API")

if not BACKEND_API:
    raise RuntimeError("no backend api")


def get_updated_elo(bill_id : int, user_id : int, user_vote : int) -> float: 
    user_response = requests.get(f'{BACKEND_API}/user/{user_id}')
    bill_response = requests.get(f'{BACKEND_API}/bill/{bill_id}')
    user_response.raise_for_status()
    bill_response.raise_for_status()

    user = user_response.json()
    bill = bill_response.json()

    elo = bill['elo']
    bill_bias = bill['bias']
    user_bias = user['bias']

    return elo_alg(elo=elo, bill_bias=bill_bias, user_bias=user_bias, user_vote=user_vote)

def elo_alg(elo : float, bill_bias : int, user_bias : float, user_vote : int) -> float :
    if bill_bias not in (0, 1, 2):
        raise ValueError("bill_bias must be 0, 1, or 2")
    if not 0.0 <= user_bias <= 1.0:
        raise ValueError("user_bias must be between 0.0 and 1.0")
    if user_vote not in (0, 1):
        raise ValueError("user_vote must be 0 or 1")

    if bill_bias == 0:
        bill_side = 1.0
    elif bill_bias == 1:
        bill_side = 0.0
    else:
        bill_side = 0.5

    distance = abs(user_bias - bill_side)
    min_boost = 5.0
    max_boost = 25.0
    boost = min_boost + ((max_boost - min_boost) * distance)
    vote_direction = 1 if user_vote == 1 else -1

    return elo + (boost * vote_direction)
