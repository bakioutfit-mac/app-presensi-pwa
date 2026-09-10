import { supabase } from './supabase';
import imageCompression from 'browser-image-compression';

/**
 * Options default for image compression - diperbarui menjadi target 2MB
 */
const DEFAULT_COMPRESSION_OPTIONS = {
  maxSizeMB: 2.0, // Maksimal 2MB sesuai permintaan user
  maxWidthOrHeight: 1920, // Kualitas Full HD
  useWebWorker: true,
  fileType: 'image/jpeg',
  initialQuality: 0.9,
};

/**
 * Compresses an image File or Blob using browser-image-compression
 * @param {File|Blob} file 
 * @param {object} customOptions 
 * @returns {Promise<File>}
 */
export async function compressImage(file, customOptions = {}) {
  try {
    const options = { ...DEFAULT_COMPRESSION_OPTIONS, ...customOptions };
    const compressedBlob = await imageCompression(file, options);
    // Ensure File object with filename
    const fileName = file.name || `img_${Date.now()}.jpg`;
    return new File([compressedBlob], fileName, { type: 'image/jpeg' });
  } catch (error) {
    console.warn('Image compression failed or skipped:', error);
    return file;
  }
}

/**
 * Converts a base64 Data URL or Blob to a File
 * @param {string} dataUrl 
 * @param {string} filename 
 * @returns {File}
 */
export function dataURLtoFile(dataUrl, filename) {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

/**
 * Upload attendance selfie photo to Supabase Storage bucket 'attendance-photos'
 * @param {File|Blob|string} imageInput - File, Blob, or base64 dataURL
 * @param {string} employeeId - Employee identifier
 * @param {string} type - 'checkin' | 'checkout'
 * @returns {Promise<string>} Public URL or fallback URL
 */
export async function uploadAttendancePhoto(imageInput, employeeId = 'emp', type = 'checkin') {
  try {
    let fileToUpload = imageInput;

    // If input is base64 string from canvas
    if (typeof imageInput === 'string' && imageInput.startsWith('data:')) {
      const filename = `${employeeId}_${type}_${Date.now()}.jpg`;
      fileToUpload = dataURLtoFile(imageInput, filename);
    }

    // Compress file
    const compressed = await compressImage(fileToUpload);
    const filePath = `${employeeId}/${Date.now()}_${type}.jpg`;

    const { data, error } = await supabase.storage
      .from('attendance-photos')
      .upload(filePath, compressed, {
        cacheControl: '3600',
        upsert: true,
      });

    if (error) {
      console.warn('Supabase storage upload error, falling back:', error.message);
      // Fallback: konversi compressed file ke Data URL agar foto tersimpan permanen & bisa dilihat di semua device
      if (typeof window !== 'undefined' && compressed instanceof Blob) {
        try {
          const dataUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(compressed);
          });
          if (dataUrl) return dataUrl;
        } catch (e) {}
      }
      if (typeof imageInput === 'string') return imageInput;
      return URL.createObjectURL(compressed);
    }

    // Get public URL
    const { data: publicData } = supabase.storage
      .from('attendance-photos')
      .getPublicUrl(data.path);

    return publicData.publicUrl;
  } catch (err) {
    console.error('Error in uploadAttendancePhoto:', err);
    if (typeof imageInput === 'string') return imageInput;
    return URL.createObjectURL(imageInput);
  }
}

/**
 * Upload leave document or doctor note to Supabase Storage bucket 'leave-documents'
 * @param {File|Blob} fileInput 
 * @param {string} employeeId 
 * @returns {Promise<string>} Public URL or fallback URL
 */
export async function uploadLeaveDocument(fileInput, employeeId = 'emp') {
  try {
    let fileToUpload = fileInput;

    if (fileInput.type && fileInput.type.startsWith('image/')) {
      fileToUpload = await compressImage(fileInput);
    }

    const ext = fileInput.name ? fileInput.name.split('.').pop() : 'jpg';
    const filePath = `${employeeId}/${Date.now()}_doc.${ext}`;

    const { data, error } = await supabase.storage
      .from('leave-documents')
      .upload(filePath, fileToUpload, {
        cacheControl: '3600',
        upsert: true,
      });

    if (error) {
      console.warn('Supabase leave document upload error, falling back:', error.message);
      return URL.createObjectURL(fileToUpload);
    }

    const { data: publicData } = supabase.storage
      .from('leave-documents')
      .getPublicUrl(data.path);

    return publicData.publicUrl;
  } catch (err) {
    console.error('Error in uploadLeaveDocument:', err);
    return URL.createObjectURL(fileInput);
  }
}
