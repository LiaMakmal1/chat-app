// Worker thread for processing images concurrently
import { parentPort, workerData } from "worker_threads";
import cloudinary from "../lib/cloudinary.js";

async function processImage(imageData) {
  try {
    // Process image upload in separate thread to avoid blocking main thread
    const uploadResponse = await cloudinary.uploader.upload(imageData, {
      folder: "chat_images",
      resource_type: "auto",
      quality: "auto:good",
      fetch_format: "auto"
    });
    
    return {
      success: true,
      url: uploadResponse.secure_url,
      publicId: uploadResponse.public_id
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Listen for messages from main thread
parentPort.on("message", async (data) => {
  const result = await processImage(data.image);
  parentPort.postMessage(result);
});