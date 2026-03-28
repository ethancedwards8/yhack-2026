from flask import Flask, jsonify, request
from app.legiscan import LegiScan

app = Flask(__name__)
legis = LegiScan()  # reads LEGISCAN_API_KEY from environment


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/search")
def search():
    query = request.args.get("q", "")
    state = request.args.get("state", "ALL")
    results = legis.search(state=state, query=query)
    return jsonify(results)


@app.route("/bill/<int:bill_id>")
def get_bill(bill_id):
    bill = legis.get_bill(bill_id)
    return jsonify(bill)
