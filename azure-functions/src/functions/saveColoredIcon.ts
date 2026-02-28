import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { BlobServiceClient } from "@azure/storage-blob";
import * as nodeCrypto from "crypto";
import { getSasUrlForBlob } from "../shared/blobSas";

// Make sure a global crypto object exists for libraries that expect it
if (!(globalThis as any).crypto && (nodeCrypto as any).webcrypto) {
  (globalThis as any).crypto = (nodeCrypto as any).webcrypto;
}

// ---- Blob storage client for colored material icons ----
const iconContainerName = "material-icons"; // Dedicated container for material icons

const getIconContainerClient = () => {
  const blobConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!blobConnectionString) {
    throw new Error("AZURE_STORAGE_CONNECTION_STRING is not set.");
  }
  const blobServiceClient = BlobServiceClient.fromConnectionString(blobConnectionString);
  return blobServiceClient.getContainerClient(iconContainerName);
};

// ---- Type for request body ----
type ColoredIconRequestBody = {
  colorVariantId: string;    // e.g., 'steel-yellow'
  imageBase64: string;       // Data URI or base64 string
  mimeType?: string;         // e.g., 'image/png'
};

export async function saveColoredIconHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return {
      status: 200,
      headers: corsHeaders
    };
  }

  let body: ColoredIconRequestBody;

  // Parse JSON body safely
  try {
    body = (await request.json()) as ColoredIconRequestBody;
  } catch (err) {
    context.log("Failed to parse JSON body", err);
      return {
        status: 400,
        body: "Invalid JSON body",
        headers: corsHeaders
      };
    }

  const {
    colorVariantId,
    imageBase64,
    mimeType = "image/png"
  } = body;

  if (!colorVariantId || !imageBase64) {
    return {
      status: 400,
      body: "colorVariantId and imageBase64 are required",
      headers: corsHeaders
    };
  }

  try {
    const iconContainerClient = getIconContainerClient();

    // Ensure blob container exists (private - we use SAS tokens for access)
    await iconContainerClient.createIfNotExists();

    // Strip data URL prefix if present
    const base64 = imageBase64.replace(/^data:.+;base64,/, "");
    const buffer = Buffer.from(base64, "base64");
    const ext = mimeType.split("/")[1] || "png";

    // Use colorVariantId as blob name for easy retrieval
    // e.g., 'steel-yellow.png'
    const blobName = `${colorVariantId}.${ext}`;
    const blockBlob = iconContainerClient.getBlockBlobClient(blobName);

    // Check if icon already exists to avoid redundant uploads
    const exists = await blockBlob.exists();
    if (exists) {
      context.log(`Icon ${blobName} already exists, returning existing URL`);
      // Return SAS URL (valid for 24 hours) since storage account doesn't allow public access
      const sasUrl = getSasUrlForBlob(blockBlob.url, 60 * 24);
      return {
        status: 200,
        jsonBody: {
          colorVariantId,
          blobUrl: sasUrl,
          cached: true
        },
        headers: corsHeaders
      };
    }

    // Upload the icon
    await blockBlob.uploadData(buffer, {
      blobHTTPHeaders: {
        blobContentType: mimeType,
        blobCacheControl: "public, max-age=31536000" // Cache for 1 year
      }
    });

    context.log(`Successfully saved colored icon: ${blobName}`);

    // Return SAS URL (valid for 24 hours) since storage account doesn't allow public access
    const sasUrl = getSasUrlForBlob(blockBlob.url, 60 * 24);
    return {
      status: 201,
      jsonBody: {
        colorVariantId,
        blobUrl: sasUrl,
        cached: false,
        createdAt: new Date().toISOString()
      },
      headers: corsHeaders
    };
  } catch (err: any) {
    context.log("Error in saveColoredIconHandler:", err?.message ?? err);
    return {
      status: 500,
      body: `Failed to save colored icon: ${err?.message ?? 'Unknown error'}`,
      headers: corsHeaders
    };
  }
}

app.http("saveColoredIcon", {
  route: "save-colored-icon",
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  handler: saveColoredIconHandler
});
