import { storage } from "../config/firebase"; // matches the export above
import { v4 as uuidv4 } from "uuid";

export const uploadToFirebase = async (
  file: Express.Multer.File,
): Promise<string> => {
  const bucket = storage.bucket(); // uses storageBucket configured in firebase.ts
  const fileName = `observations/${uuidv4()}_${file.originalname}`;
  const fileUpload = bucket.file(fileName);

  await fileUpload.save(file.buffer, {
    metadata: { contentType: file.mimetype },
  });

  await fileUpload.makePublic();

  return `https://storage.googleapis.com/${bucket.name}/${fileName}`;
};
