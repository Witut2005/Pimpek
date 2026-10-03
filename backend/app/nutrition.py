"""One normalised day of meals, read from Fitatu.

Like daily.py for wearables: the frontend only ever sees `/api/meals`, never Fitatu's
own shape. Fitatu's planner mixes what was eaten with what is only planned (diet plan
subscribers tick items off), so unticked items are listed but left out of the totals.
"""
from datetime import date, datetime
from typing import Any

from . import fitatu_service as fitatu

PROVIDER = "fitatu"
# Fitatu's item field -> ours. Values are already for the logged portion, not per 100 g.
NUTRIENTS = {
    "energy": "kcal",
    "protein": "protein",
    "fat": "fat",
    "carbohydrate": "carbs",
    "fiber": "fiber",
    "sugars": "sugars",
}
# Only used when Fitatu sends a meal without its display name.
MEAL_NAMES = {
    "breakfast": "Śniadanie",
    "second_breakfast": "II śniadanie",
    "lunch": "Lunch",
    "dinner": "Obiad",
    "snack": "Przekąska",
    "supper": "Kolacja",
}


def _number(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _amount(raw: dict[str, Any]) -> str | None:
    """Portion as Fitatu shows it ("1.5 porcja"), else the weight ("250 g")."""
    quantity, measure, weight = _number(raw.get("measureQuantity")), raw.get("measureName"), _number(raw.get("weight"))
    if quantity and measure:
        return f"{quantity:g} {measure}"
    if weight:
        return f"{weight:g} g"
    return None


def _item(raw: dict[str, Any]) -> dict[str, Any]:
    return {
        "name": raw.get("name") or "Bez nazwy",
        "brand": raw.get("brand") or None,
        "amount": _amount(raw),
        # Plain diary entries come without the flag; only an explicit False means "planned, not eaten".
        "eaten": raw.get("eaten") is not False,
        **{ours: round(_number(raw.get(theirs)), 1) for theirs, ours in NUTRIENTS.items()},
    }


def _meal(key: str, raw: dict[str, Any]) -> dict[str, Any] | None:
    items = [_item(i) for i in raw.get("items") or [] if isinstance(i, dict) and not i.get("deletedAt")]
    if not items:
        return None
    return {
        "key": key,
        "name": raw.get("mealName") or MEAL_NAMES.get(key, key),
        "time": raw.get("mealTime") or None,
        "kcal": round(sum(i["kcal"] for i in items if i["eaten"])),
        "items": items,
    }


def sources(user_id: str) -> list[dict[str, Any]]:
    status = fitatu.status(user_id)
    if not status["connected"]:
        return []
    connected_at = status.get("connected_at")
    return [
        {
            "id": PROVIDER,
            "via": PROVIDER,
            "connectedAt": datetime.fromtimestamp(connected_at).isoformat() if connected_at else None,
        }
    ]


def meals(user_id: str, day: str | None = None) -> dict[str, Any]:
    """Meals with at least one item, in Fitatu's order, plus totals of what was eaten."""
    day = day or date.today().isoformat()
    plan = fitatu.day_plan(user_id, day)
    diet = plan.get("dietPlan") if isinstance(plan, dict) else None
    # An empty plan arrives as [] rather than {}.
    if not isinstance(diet, dict):
        diet = {}
    found = [m for key, raw in diet.items() if isinstance(raw, dict) and (m := _meal(key, raw))]
    eaten = [i for m in found for i in m["items"] if i["eaten"]]
    totals = {k: round(sum(i[k] for i in eaten), 1) for k in NUTRIENTS.values()}
    totals["kcal"] = round(totals["kcal"])
    return {
        "date": day,
        "source": PROVIDER,
        "syncedAt": datetime.now().isoformat(timespec="seconds"),
        "meals": found,
        "totals": totals,
    }
