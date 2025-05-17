from flask import Flask, render_template, jsonify
import requests
import pandas as pd
import os
import threading
import time
import telegram

app = Flask(__name__)

bot_token = os.environ.get("TELEGRAM_BOT_TOKEN")
chat_id = os.environ.get("TELEGRAM_CHAT_ID")
bot = telegram.Bot(token=bot_token)

previous_pairs = set()


def get_all_mexc_prices():
    try:
        response = requests.get("https://api.mexc.com/api/v3/ticker/price").json()
        return {item['symbol']: float(item['price']) for item in response}
    except:
        return {}


def get_all_gate_prices():
    try:
        response = requests.get("https://api.gateio.ws/api2/1/tickers").json()
        return {key: float(val['last']) for key, val in response.items()}
    except:
        return {}


def get_common_symbols():
    mexc_data = requests.get("https://api.mexc.com/api/v3/exchangeInfo").json()
    gate_data = requests.get("https://api.gateio.ws/api2/1/tickers").json()

    mexc_map = {
        (item['baseAsset'].upper(), item['quoteAsset'].upper()): item['symbol']
        for item in mexc_data['symbols'] if item['quoteAsset'] == 'USDT'
    }

    gate_map = {}
    for key in gate_data:
        if key.endswith('_usdt'):
            base, quote = key.split('_')
            gate_map[(base.upper(), quote.upper())] = key

    common_keys = set(mexc_map.keys()) & set(gate_map.keys())
    return list(common_keys), mexc_map, gate_map


def get_arbitrage_opportunities():
    common_keys, mexc_map, gate_map = get_common_symbols()
    mexc_prices = get_all_mexc_prices()
    gate_prices = get_all_gate_prices()

    data = []
    for base, quote in common_keys:
        mexc_symbol = mexc_map.get((base, quote))
        gate_symbol = gate_map.get((base, quote))

        mexc_price = mexc_prices.get(mexc_symbol)
        gate_price = gate_prices.get(gate_symbol)

        if mexc_price and gate_price and gate_price != 0:
            diff_gate_to_mexc = mexc_price - gate_price
            diff_pct_gate_to_mexc = (diff_gate_to_mexc / gate_price) * 100

            diff_mexc_to_gate = gate_price - mexc_price
            diff_pct_mexc_to_gate = (diff_mexc_to_gate / mexc_price) * 100

            if 8 <= diff_pct_gate_to_mexc <= 1000:
                data.append({
                    "symbol": f"{base}/{quote}",
                    "mexc": round(mexc_price, 6),
                    "gate": round(gate_price, 6),
                    "diff": f"{diff_pct_gate_to_mexc:.2f}%",
                    "opportunity": "Gate → MEXC"
                })

            if 8 <= diff_pct_mexc_to_gate <= 1000:
                data.append({
                    "symbol": f"{base}/{quote}",
                    "mexc": round(mexc_price, 6),
                    "gate": round(gate_price, 6),
                    "diff": f"{diff_pct_mexc_to_gate:.2f}%",
                    "opportunity": "MEXC → Gate"
                })

    return sorted(data, key=lambda x: float(x["diff"].rstrip("%")))


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/data')
def data():
    opportunities = get_arbitrage_opportunities()
    return jsonify(opportunities)


def notify_new_pairs():
    global previous_pairs
    while True:
        try:
            opportunities = get_arbitrage_opportunities()
            current_pairs = set(f"{op['symbol']} - {op['opportunity']}" for op in opportunities)
            new_pairs = current_pairs - previous_pairs

            for pair in new_pairs:
                bot.send_message(chat_id=chat_id, text=f"📈 New Arbitrage Opportunity:\n{pair}")

            previous_pairs = current_pairs
        except Exception as e:
            print(f"Error in notifier: {e}")
        time.sleep(60)


if __name__ == '__main__':
    threading.Thread(target=notify_new_pairs, daemon=True).start()
    app.run(debug=True)
