import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { Image } from 'react-native';
import { supabase, supabaseUrl } from './supabase';

interface FileData {
    uri: string;
    fileName?: string;
    type?: string;
}

const SUPABASE_URL = `${supabaseUrl}/storage/v1/object/public/studyhubimages/`;

export const uploadImageToSupabase = async (
    folder: string = 'posts',
    file: FileData,
    id: string,
    oldphoto: string | null = null
): Promise<string | null> => {
    try {
        const { uri } = file;
        const filePath = `${folder}/${id}`;
        if (oldphoto)
            await deleteImageFromSupabase(filePath);


        const fileBase64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
        });

        const imageData = decode(fileBase64);

        const { data, error } = await supabase.storage.from('studyhubimages').update(filePath, imageData, {
            contentType: 'image/*',
            upsert: false,
            cacheControl: '3600',
        });

        if (error) {
            console.error('Error uploading image:', error.message);
            return null;
        }

        console.log('File uploaded successfully:', data.path);
        return `${SUPABASE_URL}${data.path}`;
    } catch (error: any) {
        console.error('Error during image upload:', error.message);
        return null;
    }
};

export const deleteImageFromSupabase = async (path: string = ''): Promise<void> => {
    try {
        const filePath = path.replace(SUPABASE_URL, '');
        const { error } = await supabase.storage.from('studyhubimages').remove([filePath]);
        if (error) {
            console.error('Error deleting image:', error.message);
        }
    } catch (error: any) {
        console.error('Error during image delete:', error.message);
    }
};

export const getImgHeight = async (uri: string): Promise<number> => {
    return new Promise((resolve, reject) => {
        Image.getSize(
            uri,
            (width, height) => {
                console.log(width, 'x', height);
                const aspectRatio = height > width ? (height / width) * 100 : (width / height) * 100;
                resolve(aspectRatio);
            },
            (error) => {
                console.error('Error getting image size:', error);
                reject(error);
            }
        );
    });
};
