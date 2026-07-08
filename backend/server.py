from fastapi import FastAPI, APIRouter, HTTPException, Body
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone

import firebase_admin
from firebase_admin import credentials, auth as fb_auth

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]
# ---------- Firebase Admin init ----------
firebase_json = os.getenv("FIREBASE_SERVICE_ACCOUNT")

if not firebase_json:
    raise RuntimeError(
        "FIREBASE_SERVICE_ACCOUNT environment variable is missing"
    )

cred = credentials.Certificate(json.loads(firebase_json))
firebase_admin.initialize_app(cred)

# Only these real, verified emails can ever get admin role.
# Edit this list to your real gmail addresses.
ADMIN_EMAILS = {"muhammadfaique012@gmail.com", "aw0329614@gmail.com"}

app = FastAPI(title="Novaaq API")
api_router = APIRouter(prefix="/api")
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ---------- Helpers ----------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


PROJ_NO_ID = {"_id": 0}


# ---------- Models ----------
Role = Literal["admin", "seller", "customer"]


class SignupIn(BaseModel):
    identifier: str  # phone, for the mock flow
    password: str
    role: Role


class LoginIn(BaseModel):
    identifier: str
    password: str


class VerifyIn(BaseModel):
    user_id: str
    code: str


class FirebaseLoginIn(BaseModel):
    id_token: str
    role: Optional[Role] = None


class FirebasePhoneLoginIn(BaseModel):
    id_token: str
    role: Optional[Role] = "customer"


class UserOut(BaseModel):
    id: str
    identifier: str
    role: Role
    verified: bool
    created_at: str


class CategoryIn(BaseModel):
    name_en: str
    name_ur: str
    max_video_seconds: int = 60
    parent_id: Optional[str] = None  # null=main category, else subcategory


class CategoryOut(BaseModel):
    id: str
    name_en: str
    name_ur: str
    max_video_seconds: int
    parent_id: Optional[str]


class PostIn(BaseModel):
    seller_id: str
    category_id: str
    media_type: Literal["video", "image"]
    media_url: str  # base64 data URI for now (swappable to Cloudinary URL)
    description: str
    duration_seconds: Optional[float] = 0


class PostUpdate(BaseModel):
    description: Optional[str] = None
    pinned: Optional[bool] = None


class PostOut(BaseModel):
    id: str
    seller_id: str
    seller_identifier: Optional[str] = None
    category_id: str
    media_type: str
    media_url: str
    description: str
    duration_seconds: float
    pinned: bool
    pinned_at: Optional[str] = None
    likes: List[str] = []
    created_at: str


class LikeIn(BaseModel):
    user_id: str


class AdIn(BaseModel):
    uploader_id: str
    media_type: Literal["video", "image"]
    media_url: str
    duration_seconds: Optional[float] = 0
    title: Optional[str] = ""


class AdOut(BaseModel):
    id: str
    uploader_id: str
    uploader_identifier: Optional[str] = None
    media_type: str
    media_url: str
    duration_seconds: float
    title: str
    active: bool
    views: int
    created_at: str


class AdConfigIn(BaseModel):
    screens_per_ad: int = 5  # show an ad every N screens/interactions


class AdConfigOut(BaseModel):
    screens_per_ad: int


# ---------- Seed defaults ----------
async def seed_defaults():
    if await db.categories.count_documents({}) == 0:
        cats = [
            {"id": new_id(), "name_en": "Clothing", "name_ur": "کپڑے", "max_video_seconds": 30, "parent_id": None},
            {"id": new_id(), "name_en": "Education", "name_ur": "تعلیم", "max_video_seconds": 360, "parent_id": None},
            {"id": new_id(), "name_en": "Food", "name_ur": "کھانا", "max_video_seconds": 60, "parent_id": None},
        ]
        await db.categories.insert_many(cats)
        subs = [
            {"id": new_id(), "name_en": "Pants", "name_ur": "پتلون", "max_video_seconds": 30, "parent_id": cats[0]["id"]},
            {"id": new_id(), "name_en": "Shirts", "name_ur": "قمیضیں", "max_video_seconds": 30, "parent_id": cats[0]["id"]},
            {"id": new_id(), "name_en": "Math", "name_ur": "ریاضی", "max_video_seconds": 360, "parent_id": cats[1]["id"]},
        ]
        await db.categories.insert_many(subs)
        logger.info("Seeded default categories")

    if await db.ad_config.count_documents({}) == 0:
        await db.ad_config.insert_one({"id": "singleton", "screens_per_ad": 5})


@app.on_event("startup")
async def on_startup():
    await seed_defaults()


# ---------- Auth: Email flow (real Firebase) ----------
@api_router.post("/auth/firebase-login")
async def firebase_login(data: FirebaseLoginIn):
    # Verified directly with Firebase's servers — the client cannot fake this.
    try:
        decoded = fb_auth.verify_id_token(data.id_token)
    except Exception:
        raise HTTPException(401, "Invalid or expired login. Please sign in again.")

    if not decoded.get("email_verified"):
        raise HTTPException(403, "Please verify your email before logging in. Check your inbox.")

    email = decoded["email"]
    is_admin_email = email in ADMIN_EMAILS
    requested_role = data.role if data.role in ("seller", "customer") else "customer"

    user = await db.users.find_one({"identifier": email}, PROJ_NO_ID)
    if not user:
        # New user: admin emails always become admin; otherwise use the role
        # they actually picked at signup (seller/customer).
        role = "admin" if is_admin_email else requested_role
        user = {
            "id": new_id(),
            "identifier": email,
            "role": role,
            "verified": True,
            "auth_provider": "firebase",
            "created_at": now_iso(),
        }
        await db.users.insert_one(user)
    elif is_admin_email and user.get("role") != "admin":
        # Existing user whose email is in ADMIN_EMAILS: keep promoting to admin.
        await db.users.update_one({"id": user["id"]}, {"$set": {"role": "admin"}})
        user["role"] = "admin"
    # Existing non-admin users keep whatever role they already have in the DB.

    return user


@api_router.post("/auth/firebase-phone-login")
async def firebase_phone_login(data: FirebasePhoneLoginIn):
    # Verified directly with Firebase — real SMS OTP was already confirmed client-side.
    try:
        decoded = fb_auth.verify_id_token(data.id_token)
    except Exception:
        raise HTTPException(401, "Invalid or expired login. Please try again.")

    phone = decoded.get("phone_number")
    if not phone:
        raise HTTPException(400, "No phone number found in this login.")

    # Phone accounts can never be admin, regardless of what's requested.
    requested_role = data.role if data.role in ("seller", "customer") else "customer"

    user = await db.users.find_one({"identifier": phone}, PROJ_NO_ID)
    if not user:
        user = {
            "id": new_id(),
            "identifier": phone,
            "role": requested_role,
            "verified": True,
            "auth_provider": "firebase",
            "created_at": now_iso(),
        }
        await db.users.insert_one(user)
    # Existing users keep their stored role; role param only applies on first creation.
    return user


# ---------- Auth: Phone flow (existing mock system, unchanged logic) ----------
@api_router.post("/auth/signup")
async def signup(data: SignupIn):
    existing = await db.users.find_one({"identifier": data.identifier}, PROJ_NO_ID)
    if existing:
        raise HTTPException(400, "Account already exists")
    # Admin role can never be granted through phone signup.
    requested_role = data.role
    if requested_role == "admin":
        raise HTTPException(403, "Admin accounts cannot be created via signup")
    user = {
        "id": new_id(),
        "identifier": data.identifier,
        "password": data.password,  # PLACEHOLDER: phone flow only, not used for email accounts
        "role": requested_role,
        "verified": False,
        "auth_provider": "mock",
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    return {"user_id": user["id"], "verification_code": "0000"}  # placeholder: any 4-6 digit accepted


@api_router.post("/auth/verify")
async def verify(data: VerifyIn):
    if not (4 <= len(data.code) <= 6) or not data.code.isdigit():
        raise HTTPException(400, "Invalid code")
    user = await db.users.find_one({"id": data.user_id}, PROJ_NO_ID)
    if not user:
        raise HTTPException(404, "User not found")
    await db.users.update_one({"id": data.user_id}, {"$set": {"verified": True}})
    user["verified"] = True
    user.pop("password", None)
    return user


@api_router.post("/auth/login")
async def login(data: LoginIn):
    # Phone/mock flow only. Email accounts must use /auth/firebase-login.
    user = await db.users.find_one({"identifier": data.identifier}, PROJ_NO_ID)
    if not user:
        raise HTTPException(404, "Account not found")
    if user.get("password") != data.password:
        raise HTTPException(401, "Wrong password")
    # Phone accounts can never be admin, regardless of what's stored in the DB.
    if user.get("role") == "admin" and user.get("auth_provider") != "firebase":
        user["role"] = "customer"
        await db.users.update_one({"id": user["id"]}, {"$set": {"role": "customer"}})
    user.pop("password", None)
    return user


@api_router.get("/auth/user/{user_id}")
async def get_user(user_id: str):
    user = await db.users.find_one({"id": user_id}, PROJ_NO_ID)
    if not user:
        raise HTTPException(404, "User not found")
    user.pop("password", None)
    return user


# ---------- Categories ----------
@api_router.get("/categories", response_model=List[CategoryOut])
async def list_categories():
    cats = await db.categories.find({}, PROJ_NO_ID).to_list(1000)
    return cats


@api_router.post("/categories", response_model=CategoryOut)
async def create_category(data: CategoryIn):
    cat = {"id": new_id(), **data.model_dump()}
    await db.categories.insert_one(cat)
    cat.pop("_id", None)
    return cat


@api_router.put("/categories/{cat_id}", response_model=CategoryOut)
async def update_category(cat_id: str, data: CategoryIn):
    res = await db.categories.update_one({"id": cat_id}, {"$set": data.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(404, "Category not found")
    cat = await db.categories.find_one({"id": cat_id}, PROJ_NO_ID)
    return cat


@api_router.delete("/categories/{cat_id}")
async def delete_category(cat_id: str):
    await db.categories.delete_many({"parent_id": cat_id})
    await db.categories.delete_one({"id": cat_id})
    await db.posts.delete_many({"category_id": cat_id})
    return {"ok": True}


# ---------- Posts ----------
async def enrich_post(p: dict) -> dict:
    seller = await db.users.find_one({"id": p.get("seller_id")}, {"_id": 0, "identifier": 1})
    p["seller_identifier"] = seller["identifier"] if seller else None
    return p


@api_router.get("/posts", response_model=List[PostOut])
async def list_posts(category_id: Optional[str] = None, seller_id: Optional[str] = None):
    q = {}
    if category_id:
        q["category_id"] = category_id
    if seller_id:
        q["seller_id"] = seller_id
    posts = await db.posts.find(q, PROJ_NO_ID).to_list(2000)
    pinned = sorted([p for p in posts if p.get("pinned")], key=lambda x: x.get("pinned_at") or "")
    rest = sorted([p for p in posts if not p.get("pinned")], key=lambda x: x.get("created_at", ""), reverse=True)
    ordered = pinned + rest
    for p in ordered:
        await enrich_post(p)
    return ordered


@api_router.post("/posts", response_model=PostOut)
async def create_post(data: PostIn):
    cat = await db.categories.find_one({"id": data.category_id}, PROJ_NO_ID)
    if not cat:
        raise HTTPException(400, "Invalid category")
    if data.media_type == "video" and data.duration_seconds and data.duration_seconds > cat["max_video_seconds"]:
        raise HTTPException(400, f"Video exceeds max duration ({cat['max_video_seconds']}s)")
    post = {
        "id": new_id(),
        **data.model_dump(),
        "pinned": False,
        "pinned_at": None,
        "likes": [],
        "created_at": now_iso(),
    }
    await db.posts.insert_one(post)
    post.pop("_id", None)
    await enrich_post(post)
    return post


@api_router.put("/posts/{post_id}", response_model=PostOut)
async def update_post(post_id: str, data: PostUpdate):
    upd = {k: v for k, v in data.model_dump().items() if v is not None}
    if "pinned" in upd:
        upd["pinned_at"] = now_iso() if upd["pinned"] else None
    if upd:
        res = await db.posts.update_one({"id": post_id}, {"$set": upd})
        if res.matched_count == 0:
            raise HTTPException(404, "Post not found")
    post = await db.posts.find_one({"id": post_id}, PROJ_NO_ID)
    await enrich_post(post)
    return post


@api_router.delete("/posts/{post_id}")
async def delete_post(post_id: str):
    await db.posts.delete_one({"id": post_id})
    return {"ok": True}


@api_router.post("/posts/{post_id}/like")
async def toggle_like(post_id: str, data: LikeIn):
    post = await db.posts.find_one({"id": post_id}, PROJ_NO_ID)
    if not post:
        raise HTTPException(404, "Post not found")
    likes = post.get("likes", [])
    if data.user_id in likes:
        likes.remove(data.user_id)
    else:
        likes.append(data.user_id)
    await db.posts.update_one({"id": post_id}, {"$set": {"likes": likes}})
    return {"likes": len(likes), "liked": data.user_id in likes}


# ---------- Ads ----------
async def enrich_ad(a: dict) -> dict:
    up = await db.users.find_one({"id": a.get("uploader_id")}, {"_id": 0, "identifier": 1})
    a["uploader_identifier"] = up["identifier"] if up else None
    return a


@api_router.get("/ads", response_model=List[AdOut])
async def list_ads(active_only: bool = False, uploader_id: Optional[str] = None):
    q = {}
    if active_only:
        q["active"] = True
    if uploader_id:
        q["uploader_id"] = uploader_id
    ads = await db.ads.find(q, PROJ_NO_ID).to_list(500)
    for a in ads:
        await enrich_ad(a)
    return ads


@api_router.post("/ads", response_model=AdOut)
async def create_ad(data: AdIn):
    if data.media_type == "video" and data.duration_seconds and data.duration_seconds > 15:
        raise HTTPException(400, "Ad video max 15 seconds")
    ad = {
        "id": new_id(),
        **data.model_dump(),
        "active": True,
        "views": 0,
        "created_at": now_iso(),
    }
    await db.ads.insert_one(ad)
    ad.pop("_id", None)
    await enrich_ad(ad)
    return ad


@api_router.put("/ads/{ad_id}/toggle")
async def toggle_ad(ad_id: str):
    ad = await db.ads.find_one({"id": ad_id}, PROJ_NO_ID)
    if not ad:
        raise HTTPException(404, "Ad not found")
    await db.ads.update_one({"id": ad_id}, {"$set": {"active": not ad.get("active", True)}})
    return {"ok": True, "active": not ad.get("active", True)}


@api_router.delete("/ads/{ad_id}")
async def delete_ad(ad_id: str):
    await db.ads.delete_one({"id": ad_id})
    return {"ok": True}


@api_router.post("/ads/{ad_id}/view")
async def record_ad_view(ad_id: str):
    res = await db.ads.update_one({"id": ad_id}, {"$inc": {"views": 1}})
    if res.matched_count == 0:
        raise HTTPException(404, "Ad not found")
    return {"ok": True}


@api_router.get("/ad-config", response_model=AdConfigOut)
async def get_ad_config():
    cfg = await db.ad_config.find_one({"id": "singleton"}, PROJ_NO_ID)
    if not cfg:
        return {"screens_per_ad": 5}
    return {"screens_per_ad": cfg.get("screens_per_ad", 5)}


@api_router.put("/ad-config", response_model=AdConfigOut)
async def set_ad_config(data: AdConfigIn):
    await db.ad_config.update_one(
        {"id": "singleton"}, {"$set": {"screens_per_ad": max(1, data.screens_per_ad)}}, upsert=True
    )
    return {"screens_per_ad": data.screens_per_ad}


@api_router.get("/")
async def root():
    return {"message": "Novaaq API"}


@api_router.get("/users/lookup")
async def lookup_user(identifier: str):
    user = await db.users.find_one({"identifier": identifier}, PROJ_NO_ID)
    if not user:
        raise HTTPException(404, "User not found")
    return {"id": user["id"], "identifier": user["identifier"], "role": user.get("role")}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "https://novaaq-project.onrender.com",
    ],
    allow_origin_regex=r"https://.*\.onrender\.com",
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
