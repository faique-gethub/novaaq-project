"""Novaaq backend integration tests - full coverage of auth, categories, posts, ads, ad-config."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "https://triangle-bazaar.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

# Small 1x1 PNG data URI
IMG_DATA_URI = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def unique():
    return uuid.uuid4().hex[:8]


# --------- Health ----------
def test_health_root(s):
    r = s.get(f"{API}/")
    assert r.status_code == 200
    assert r.json().get("message") == "Novaaq API"


# --------- Auth ----------
def test_signup_and_verify_and_login(s, unique):
    email = f"TEST_seller_{unique}@example.com"
    r = s.post(f"{API}/auth/signup", json={"identifier": email, "password": "pw123", "role": "seller"})
    assert r.status_code == 200, r.text
    uid = r.json()["user_id"]
    assert uid

    # duplicate signup fails
    r2 = s.post(f"{API}/auth/signup", json={"identifier": email, "password": "pw123", "role": "seller"})
    assert r2.status_code == 400

    # verify with any 4-6 digit
    rv = s.post(f"{API}/auth/verify", json={"user_id": uid, "code": "1234"})
    assert rv.status_code == 200
    body = rv.json()
    assert body["verified"] is True
    assert body["id"] == uid
    assert body["role"] == "seller"
    assert "password" not in body

    # invalid code
    rbad = s.post(f"{API}/auth/verify", json={"user_id": uid, "code": "abc"})
    assert rbad.status_code == 400

    # login
    rl = s.post(f"{API}/auth/login", json={"identifier": email, "password": "pw123"})
    assert rl.status_code == 200
    u = rl.json()
    assert u["verified"] is True
    assert u["id"] == uid

    # wrong password
    rw = s.post(f"{API}/auth/login", json={"identifier": email, "password": "bad"})
    assert rw.status_code == 401

    # unknown user
    rn = s.post(f"{API}/auth/login", json={"identifier": "TEST_nope@x.com", "password": "x"})
    assert rn.status_code == 404


# --------- Categories ----------
def test_categories_seeded(s):
    r = s.get(f"{API}/categories")
    assert r.status_code == 200
    cats = r.json()
    names = {c["name_en"] for c in cats}
    assert {"Clothing", "Education", "Food"}.issubset(names)


def test_categories_crud_and_cascade(s, unique):
    # create parent
    r = s.post(f"{API}/categories", json={"name_en": f"TEST_Cat_{unique}", "name_ur": "ٹیسٹ", "max_video_seconds": 10, "parent_id": None})
    assert r.status_code == 200
    parent = r.json()
    pid = parent["id"]
    assert parent["max_video_seconds"] == 10

    # sub
    rs = s.post(f"{API}/categories", json={"name_en": f"TEST_Sub_{unique}", "name_ur": "ذیلی", "max_video_seconds": 10, "parent_id": pid})
    assert rs.status_code == 200
    sub_id = rs.json()["id"]

    # update
    ru = s.put(f"{API}/categories/{pid}", json={"name_en": f"TEST_Cat_{unique}_2", "name_ur": "ٹیسٹ", "max_video_seconds": 20, "parent_id": None})
    assert ru.status_code == 200
    assert ru.json()["max_video_seconds"] == 20

    # create seller + post inside this category to test cascade delete
    email = f"TEST_delseller_{unique}@x.com"
    ru2 = s.post(f"{API}/auth/signup", json={"identifier": email, "password": "pw", "role": "seller"})
    uid = ru2.json()["user_id"]
    s.post(f"{API}/auth/verify", json={"user_id": uid, "code": "1111"})
    rp = s.post(f"{API}/posts", json={
        "seller_id": uid, "category_id": pid, "media_type": "image",
        "media_url": IMG_DATA_URI, "description": "TEST cascade", "duration_seconds": 0,
    })
    assert rp.status_code == 200
    post_id = rp.json()["id"]

    # delete parent -> subcategory and posts removed
    rd = s.delete(f"{API}/categories/{pid}")
    assert rd.status_code == 200

    all_cats = s.get(f"{API}/categories").json()
    ids = {c["id"] for c in all_cats}
    assert pid not in ids
    assert sub_id not in ids

    # post should also be gone
    posts = s.get(f"{API}/posts", params={"category_id": pid}).json()
    assert not any(p["id"] == post_id for p in posts)


# --------- Posts ----------
@pytest.fixture(scope="session")
def seller_user(s, unique):
    email = f"TEST_seller_main_{unique}@x.com"
    r = s.post(f"{API}/auth/signup", json={"identifier": email, "password": "pw", "role": "seller"})
    uid = r.json()["user_id"]
    s.post(f"{API}/auth/verify", json={"user_id": uid, "code": "1234"})
    return {"id": uid, "identifier": email}


@pytest.fixture(scope="session")
def clothing_cat(s):
    cats = s.get(f"{API}/categories").json()
    return next(c for c in cats if c["name_en"] == "Clothing")


def test_post_rejects_video_exceeding_max(s, seller_user, clothing_cat):
    # Clothing has 30s max
    r = s.post(f"{API}/posts", json={
        "seller_id": seller_user["id"], "category_id": clothing_cat["id"],
        "media_type": "video", "media_url": "data:video/mp4;base64,AAAA",
        "description": "TEST too long", "duration_seconds": 45,
    })
    assert r.status_code == 400


def test_post_create_and_list_and_pin_and_like(s, seller_user, clothing_cat):
    # 3 posts
    ids = []
    for i in range(3):
        r = s.post(f"{API}/posts", json={
            "seller_id": seller_user["id"], "category_id": clothing_cat["id"],
            "media_type": "image", "media_url": IMG_DATA_URI,
            "description": f"TEST post {i}", "duration_seconds": 0,
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["seller_identifier"] == seller_user["identifier"]
        ids.append(body["id"])
        time.sleep(0.05)

    # pin the FIRST one (oldest) -> it should appear first even though it is oldest
    rp = s.put(f"{API}/posts/{ids[0]}", json={"pinned": True})
    assert rp.status_code == 200
    assert rp.json()["pinned"] is True
    assert rp.json()["pinned_at"]

    listing = s.get(f"{API}/posts", params={"category_id": clothing_cat["id"]}).json()
    our = [p for p in listing if p["id"] in ids]
    assert our[0]["id"] == ids[0], "Pinned post must appear first"
    # among rest (non-pinned), newest first
    rest_ids = [p["id"] for p in our if not p["pinned"]]
    # ids[2] is newest of unpinned
    assert rest_ids[0] == ids[2]

    # like toggle
    rl = s.post(f"{API}/posts/{ids[1]}/like", json={"user_id": seller_user["id"]})
    assert rl.status_code == 200
    assert rl.json()["liked"] is True
    assert rl.json()["likes"] == 1
    rl2 = s.post(f"{API}/posts/{ids[1]}/like", json={"user_id": seller_user["id"]})
    assert rl2.json()["liked"] is False
    assert rl2.json()["likes"] == 0

    # unpin
    ru = s.put(f"{API}/posts/{ids[0]}", json={"pinned": False})
    assert ru.status_code == 200
    assert ru.json()["pinned"] is False
    assert ru.json()["pinned_at"] is None

    # delete cleanup
    for pid in ids:
        s.delete(f"{API}/posts/{pid}")


def test_post_invalid_category(s, seller_user):
    r = s.post(f"{API}/posts", json={
        "seller_id": seller_user["id"], "category_id": "nonexistent",
        "media_type": "image", "media_url": IMG_DATA_URI,
        "description": "TEST", "duration_seconds": 0,
    })
    assert r.status_code == 400


# --------- Ads ----------
def test_ad_video_length_and_toggle_delete_view(s, seller_user):
    # video >15s -> 400
    r_bad = s.post(f"{API}/ads", json={
        "uploader_id": seller_user["id"], "media_type": "video",
        "media_url": "data:video/mp4;base64,AAAA", "duration_seconds": 20, "title": "TEST bad",
    })
    assert r_bad.status_code == 400

    # image ok
    r = s.post(f"{API}/ads", json={
        "uploader_id": seller_user["id"], "media_type": "image",
        "media_url": IMG_DATA_URI, "duration_seconds": 0, "title": "TEST ad img",
    })
    assert r.status_code == 200
    ad = r.json()
    assert ad["active"] is True
    assert ad["views"] == 0
    assert ad["uploader_identifier"] == seller_user["identifier"]
    aid = ad["id"]

    # short video ok (<=15s)
    r_v = s.post(f"{API}/ads", json={
        "uploader_id": seller_user["id"], "media_type": "video",
        "media_url": "data:video/mp4;base64,AAAA", "duration_seconds": 10, "title": "TEST ad vid",
    })
    assert r_v.status_code == 200

    # view count
    s.post(f"{API}/ads/{aid}/view")
    s.post(f"{API}/ads/{aid}/view")
    listing = s.get(f"{API}/ads").json()
    this_ad = next(a for a in listing if a["id"] == aid)
    assert this_ad["views"] == 2

    # toggle -> active becomes False
    rt = s.put(f"{API}/ads/{aid}/toggle")
    assert rt.status_code == 200
    listing2 = s.get(f"{API}/ads", params={"active_only": True}).json()
    assert not any(a["id"] == aid for a in listing2)

    # delete
    rd = s.delete(f"{API}/ads/{aid}")
    assert rd.status_code == 200
    rd2 = s.delete(f"{API}/ads/{r_v.json()['id']}")
    assert rd2.status_code == 200


# --------- Ad config ----------
def test_ad_config_persistence(s):
    r = s.get(f"{API}/ad-config")
    assert r.status_code == 200
    original = r.json()["screens_per_ad"]

    ru = s.put(f"{API}/ad-config", json={"screens_per_ad": 7})
    assert ru.status_code == 200

    r2 = s.get(f"{API}/ad-config")
    assert r2.json()["screens_per_ad"] == 7

    # restore
    s.put(f"{API}/ad-config", json={"screens_per_ad": original})
