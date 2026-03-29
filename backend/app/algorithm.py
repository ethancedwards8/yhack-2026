import requests
import os
from pathlib import Path
from dotenv import load_dotenv


ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=ENV_PATH)
BACKEND_API = os.getenv("BACKEND_API")


def get_updated_elo(bill_id : int, user_id : int, user_vote : int) -> float: 
    if not BACKEND_API:
        raise RuntimeError("BACKEND_API must be set to call get_updated_elo")
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


def user_bias_alg(user_bias: float, bill_bias: int, user_vote: int) -> float:
    """Adjust a user's political position based on their vote on a bill.

    Parameters
    ----------
    user_bias : float
        Current position on [0.0, 1.0].
        0.0 = fully left/Democratic, 1.0 = fully right/Republican, 0.5 = neutral.
    bill_bias : int
        0 = Democratic, 1 = Republican, 2 = Independent.
    user_vote : int
        1 = upvote/agree, 0 = downvote/disagree.

    Returns
    -------
    float
        Updated user_bias, clamped to [0.0, 1.0].

    The shift follows the same ELO intuition as ``elo_alg``:
    * Voting *for* a bill pulls the user toward that bill's side.
    * Voting *against* a bill pushes the user toward the opposite side.
    * The magnitude scales with how "surprising" the vote is — a large
      gap between the user's current lean and the vote direction produces
      a bigger swing (K ranges from 0.02 to 0.05).
    * Independent bills (bill_bias == 2) have no effect on user bias.
    """
    if bill_bias not in (0, 1, 2):
        raise ValueError("bill_bias must be 0, 1, or 2")
    if not 0.0 <= user_bias <= 1.0:
        raise ValueError("user_bias must be between 0.0 and 1.0")
    if user_vote not in (0, 1):
        raise ValueError("user_vote must be 0 or 1")

    # Independent bills don't shift user bias
    if bill_bias == 2:
        return user_bias

    # 0.0 = Democratic side, 1.0 = Republican side
    bill_side = float(bill_bias)

    # Upvote → pull toward the bill's side
    # Downvote → push toward the opposite side
    target = bill_side if user_vote == 1 else 1.0 - bill_side

    gap = abs(target - user_bias)

    # K-factor: base + surprise bonus (mirrors min_boost / max_boost in elo_alg)
    k = 0.02 + 0.03 * gap  # 0.02 when aligned, up to 0.05 at maximum distance

    if target > user_bias:
        shift = k
    elif target < user_bias:
        shift = -k
    else:
        shift = 0.0

    return max(0.0, min(1.0, round(user_bias + shift, 4)))


def match_algo(user_id: int, take: int = 5) -> list[dict[str, object]]:
    if not BACKEND_API:
        raise RuntimeError("BACKEND_API must be set to call match_algo")

    try:
        user_id_int = int(user_id)
    except (TypeError, ValueError):
        raise ValueError("user_id must be an integer")

    try:
        take_int = int(take)
    except (TypeError, ValueError):
        raise ValueError("take must be an integer")

    response = requests.post(
        f"{BACKEND_API}/match",
        json={"user_id": user_id_int, "take": take_int},
    )
    response.raise_for_status()
    payload = response.json()

    if isinstance(payload, dict):
        matches = payload.get("matches")
        if isinstance(matches, list):
            return matches
        return []

    return payload if isinstance(payload, list) else []