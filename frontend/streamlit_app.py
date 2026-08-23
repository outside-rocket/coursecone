"""CampusPeer — Streamlit frontend.

Run:  streamlit run frontend/streamlit_app.py   (with backend on :8000)
"""
import json
import os

import requests
import streamlit as st

API = os.getenv("CAMPUSPEER_API", "http://localhost:8000")

st.set_page_config(page_title="CampusPeer", page_icon="🎓", layout="wide")

if "token" not in st.session_state:
    st.session_state.token = None
if "name" not in st.session_state:
    st.session_state.name = None


def api(method, path, json_body=None, auth=True):
    headers = {"Authorization": f"Bearer {st.session_state.token}"} if auth and st.session_state.token else {}
    r = requests.request(method, API + path, json=json_body, headers=headers, timeout=30)
    if r.status_code >= 400:
        try:
            raise RuntimeError(r.json().get("detail", r.text))
        except json.JSONDecodeError:
            raise RuntimeError(r.text)
    return r.json()


# ---------------- Auth ----------------
if not st.session_state.token:
    st.title("🎓 CampusPeer")
    st.caption("Timetable match · FFCS slot exchange · academic social hub (SDG 4 & 10)")
    tab_login, tab_reg = st.tabs(["Login", "Register"])
    with tab_login:
        email = st.text_input("VIT Email", key="li_e")
        pw = st.text_input("Password", type="password", key="li_p")
        if st.button("Login") and email:
            res = api("POST", "/api/auth/login",
                      {"email": email, "password": pw}, auth=False)
            st.session_state.token = res["token"]
            st.session_state.name = res["name"]
            st.rerun()
    with tab_reg:
        rn = st.text_input("Roll No", key="rg_r")
        nm = st.text_input("Full Name", key="rg_n")
        em = st.text_input("Email (@vitstudent.ac.in)", key="rg_e")
        rp = st.text_input("Password", type="password", key="rg_p")
        if st.button("Create account"):
            res = api("POST", "/api/auth/register",
                      {"roll_no": rn, "name": nm, "email": em, "password": rp}, auth=False)
            st.session_state.token = res["token"]
            st.session_state.name = nm
            st.rerun()
    st.stop()

# ---------------- Main app ----------------
tab_tt, tab_peers, tab_social, tab_swap = st.tabs(
    ["📅 My Timetable", "🔍 Find Classmates", "👥 Social", "🔄 Slot Trade Market"])

with tab_tt:
    st.subheader("Upload your FFCS registration")
    raw = st.text_area(
        "Paste the table copied from the registration portal "
        "(Course Code & Title → Status):", height=180,
        placeholder="BCSE302L - Data Structures...\t4\tPC\tHard\tCH2026270100945 - 53616 - AB3-505\tA1+TA1\tDr. Ramesh (53616)\tRegistered\n...")
    c1, c2 = st.columns([1, 4])
    if c1.button("Parse & Save"):
        try:
            out = api("POST", "/api/timetable/upload", {"raw_text": raw})
            st.success(f"Saved {len(out['saved_courses'])} courses!")
        except Exception as e:
            st.error(e)
    if c2.button("Refresh grid"):
        st.rerun()

    try:
        grid = api("GET", "/api/timetable/grid")
        days = grid["days"]
        st.markdown("### Weekly Timetable")
        header = st.columns([2] + [3] * 5)
        for col, d in zip(header[1:], days):
            col.markdown(f"**{d}**")
        for label, row in zip(grid["morning_hours"] + ["🍱 Lunch"] + grid["afternoon_hours"],
                              grid["theory"][:5] + [None] + grid["theory"][5:]):
            header[0].write(label)
            if row is None:
                continue
            for col, cell in zip(header[1:], row):
                if cell:
                    col.markdown(
                        f"<div style='background:{cell['color']};padding:6px;border-radius:6px'>"
                        f"<b>{cell['course_code']}</b><br>{cell['venue']}<br>"
                        f"<small>{cell['slot_token']}</small></div>",
                        unsafe_allow_html=True)
                else:
                    col.markdown("<div style='background:#f0f2f6;padding:6px;border-radius:"
                                 "6px;color:#888;text-align:center'>free</div>",
                                 unsafe_allow_html=True)

        if grid["lab"]:
            st.markdown("### Labs")
            for entry in grid["lab"]:
                cells = ", ".join(f"{c['course_code']} @ {c['venue']} [{c['slot_token']}]"
                                  for c in entry["entries"])
                st.write(f"**{entry['day']} {entry['time']}** — {cells}")
        st.info(f"{grid['free_cells']} free theory periods this week — perfect for study planning.")
    except Exception as e:
        st.warning(f"No timetable yet ({e}) — paste your schedule above.")

with tab_peers:
    st.subheader("Find Classmates in a Course / Slot")
    cc = st.text_input("Course code", placeholder="BCSE302L").upper()
    sl = st.text_input("Slot token (optional)", placeholder="A1").upper()
    if st.button("Search") and cc:
        try:
            res = api("GET", f"/api/classmates/find?course_code={cc}&slot_token={sl}")
            st.write(f"**{res['count']} classmates found** (contacts masked until mutual follow)")
            for m in res["classmates"]:
                with st.container(border=True):
                    col_a, col_b = st.columns([4, 1])
                    col_a.write(f"👤 **{m['name']}** — " + "; ".join(
                        f"{c['slot']} @ {c['venue']}" for c in m["classes"]))
                    label = "Following ✓" if m["is_following"] else "Follow"
                    if col_b.button(label, key=f"f_{m['student_id']}"):
                        api("POST", "/api/social/follow", {"student_id": m["student_id"]})
                        st.rerun()
        except Exception as e:
            st.error(e)

with tab_social:
    st.subheader("Your Network")
    net = api("GET", "/api/social/followers")
    col1, col2, col3 = st.columns(3)
    col1.metric("Followers", len(net["followers"]))
    col2.metric("Following", len(net["following"]))
    col3.metric("Mutual 🔒 chat unlocked", len(net["mutual"]))
    st.write("**Mutuals:** " + (", ".join(
        next((u['name'] for u in net['followers'] + net['following']
              if u['student_id'] == mid), mid) for mid in net["mutual"]) or "—"))
    other = st.selectbox("Chat with mutual:", ["—"] + [
        u["student_id"] for u in net["followers"] + net["following"]
        if u["student_id"] in net["mutual"]])
    if other != "—":
        msgs = api("GET", f"/api/social/messages/{other}")
        for msg in msgs:
            who = "You" if msg["from"] == str(api("GET", "/api/auth/me")["student_id"]) else "Them"
            st.chat_message(who).write(msg["text"])
        text = st.chat_input("Message…")
        if text:
            api("POST", "/api/social/message", {"receiver_id": other, "message_text": text})
            st.rerun()

with tab_swap:
    st.subheader("FFCS Slot Trade Market")
    with st.expander("➕ List a slot for exchange"):
        enr = st.text_input("Class ID you're dropping", placeholder="CH2026270100945")
        want = st.text_input("Desired course code", placeholder="BCSE302L").upper()
        want_tokens = st.text_input("Desired slots (+ separated)", placeholder="B2+TB2 or A2+TA2")
        if st.button("Create listing"):
            try:
                api("POST", "/api/swap/list", {
                    "offered_class_id": enr,
                    "desired_course_code": want,
                    "desired_slot_tokens": [t.strip().upper() for t in want_tokens.split("+") if t]})
                st.success("Listing is OPEN 🎉")
            except Exception as e:
                st.error(e)
    if st.button("Find my matches"):
        try:
            res = api("GET", "/api/swap/match")
            if not res["one_to_one"] and not res["three_way_cycles"]:
                st.info("No compatible matches yet.")
            for pair in res["one_to_one"]:
                p = pair["peer_listing"]
                with st.container(border=True):
                    st.write(f"🔁 Direct swap: they offer **{'+'.join(p['offered_slot_tokens'])}**"
                             f" ({p['offered_course_code']}), want your {p['desired_course_code']}")
                    if st.button("Accept & Execute swap", key=str(p["listing_id"])):
                        out = api("POST", "/api/swap/execute", {
                            "my_listing_id": pair["my_listing"]["listing_id"],
                            "peer_listing_id": p["listing_id"]})
                        st.success(json.dumps(out))
            for cyc in res["three_way_cycles"]:
                chain = " → ".join(c["offered_course_code"] + ":" +
                                   "+".join(c["offered_slot_tokens"]) for c in cyc["cycle"])
                st.warning(f"🌀 3-way cycle detected: {chain}")
        except Exception as e:
            st.error(e)

st.sidebar.button("Logout", on_click=lambda: (
    st.session_state.update(token=None, name=None)) or st.rerun())
