from flask import Flask, redirect, url_for, render_template, request, send_from_directory, session
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from snippet import get_img
import os
import requests

app = Flask(__name__)
app.secret_key = 'KEQING'

limiter = Limiter(get_remote_address, app=app)

@app.route("/")
def home():
    return render_template("index.html")

sorts = [
            "quicksort", "bubblesort", "selectionsort", "insertionsort", "radixsort", "heapsort", "gnomesort", "mergesort",
            "bogosort", "shellsort", "shakersort", "bitonicsort", "oddevensort", "combsort", "pancakesort", "customsort"
        ]

for sort in sorts:
    fname = sort[:-4] + "_" + sort[-4:]

    fun = f"""
@app.route("/{sort}/", methods=["GET"])
def {fname}():
    return render_template("sorts/{sort}.html", audio=session.get("audio", True))"""

    exec(fun)

@app.route("/submit/", methods=["POST"])
@limiter.limit("5/hour")
def submit():
    code = request.json["code"]
    image = get_img(code)
    return "", 204

@app.route("/audio/", methods=["PUT"])
def change_audio():
    session["audio"] = not session.get("audio", True)
    return "", 204

if __name__ == "__main__":
    app.run(debug=True)
