import { supabase } from "../config/supabase";
import { v4 as uuidv4 } from "uuid";

const BUCKET_NAME = process.env.SUPABASE_STORAGE_BUCKET || "observation-photos";

export const uploadToSupabase = async (
  file: Express.Multer.File,
): Promise<string> => {
  const fileName = `observations/${uuidv4()}_${file.originalname}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: false, // fail if a file with this exact name exists (shouldn't happen with uuid)
    });

  if (uploadError) {
    throw new Error(`Supabase upload failed: ${uploadError.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(fileName);

  return publicUrlData.publicUrl;
};
