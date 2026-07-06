// Upload service — isolated so UI never changes when swapping storage providers.
// Now wired to Cloudinary (unsigned upload preset).
export type MediaKind = "video" | "image";

const CLOUDINARY_CLOUD_NAME = "t1e42qoz";
const CLOUDINARY_UPLOAD_PRESET = "hyperlocal_marketplace";

async function toBase64(uri: string): Promise<string> {
  const res = await fetch(uri);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

export async function uploadMedia(input: {
  uri: string;
  base64?: string | null;
  kind: MediaKind;
  mime?: string;
}): Promise<string> {
  const { uri, base64, kind, mime } = input;
  const contentType = mime || (kind === "video" ? "video/mp4" : "image/jpeg");

  // Get a base64 data URI to send to Cloudinary (works for both web and native)
  let dataUri: string;
  if (base64) {
    dataUri = `data:${contentType};base64,${base64}`;
  } else {
    dataUri = await toBase64(uri);
  }

  const resourceType = kind === "video" ? "video" : "image";
  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;

  const formData = new FormData();
  formData.append("file", dataUri);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", "novaaq");

  const res = await fetch(endpoint, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Cloudinary upload failed: ${res.status} ${errText}`);
  }

  const json = await res.json();
  return json.secure_url as string;
}
