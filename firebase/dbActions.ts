import { ref, uploadBytes, getDownloadURL, getStorage } from "firebase/storage";

import { db } from './FirebaseConfig';

import { collection, query, where, getDocs, addDoc, deleteDoc, updateDoc, doc, getDoc, increment, orderBy, runTransaction, arrayUnion, arrayRemove, setDoc, limit, startAfter } from "firebase/firestore";
import { ToastAndroid } from "react-native";
import { router } from "expo-router";
import { answer, Question, reply } from "@/types/types";
import { deleteImageFromSupabase } from "@/services/images";


//create('people',data)

export const create = async (collectionName = 'questions', post = {}, image?: any) => {
    try {

        const docposted = await addDoc(collection(db, collectionName), { ...post });
        console.log('Added to DB', docposted.id);

        return true;
    } catch (error) {
        console.error("Error adding post:", error); // Log the error
        return false; // Return false if there's an error
    }
};

export const read = async (limitnum = 10, from = 'questions', startAfterDoc?: any) => {
    try {
        let q;
        if (startAfterDoc) {
            q = query(
                collection(db, from),
                orderBy("created_at", "desc"),
                startAfter(startAfterDoc),
                limit(limitnum)
            );
        } else {
            q = query(
                collection(db, from),
                orderBy("created_at", "desc"),
                limit(limitnum)
            );
        }

        const querySnapshot = await getDocs(q);

        const questions: object[] = [];
        querySnapshot.forEach((doc) => {
            questions.push({
                id: doc.id,
                ...doc.data(),
            });
        });

        const lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];

        return { questions, lastVisible };
    } catch (error) {
        console.error('GET questions Error ', error);
        return null;
    }
}
export const readByUserId = async (userId: string, from = 'questions') => {
    try {
        const q = query(
            collection(db, from), // Specify the collection
            where("user", "==", userId),
            orderBy("created_at", "desc")
        );

        const querySnapshot = await getDocs(q);
        const questions: object[] = [];


        querySnapshot.forEach((doc) => {
            questions.push({ id: doc.id, ...doc.data() }); // Add each document to the questions array
        });

        return questions; // Return the array of questions
    } catch (error) {
        console.error("Error fetching questions by user uid:", error);
        return []; // Return an empty array on error
    }
};





export const deleteItem = async (collectionName: string = 'questions', id: string) => {
    try {



        const postRef = doc(db, collectionName, id);

        const docSnap = await getDoc(postRef);

        if (docSnap.exists()) {
            const item = { id: docSnap.id, ...docSnap.data() } as any;

            if (item?.image) {
                deleteImageFromSupabase(item?.image)
            } else if (item?.images) {
                item.images.forEach((image: any) => {
                    deleteImageFromSupabase(image)
                })
            }
        } else {
            console.log("No document found with the given ID.");
            return null;
        }

        await deleteDoc(postRef);

        ToastAndroid.show('Deleted successfully', ToastAndroid.SHORT)

        return true;
    } catch (error) {
        console.error("Error deleting post:", error);
        return false;
    }
};

export const readById = async (collectionName: string = 'questions', id: string) => {
    try {
        // Reference to the document by ID
        const postRef = doc(db, collectionName, id);
        // Fetch the document
        const docSnap = await getDoc(postRef);

        if (docSnap.exists()) {
            // Return the document data with its ID
            return { id: docSnap.id, ...docSnap.data() };
        } else {
            console.log("No document found with the given ID.");
            return null;
        }
    } catch (error) {
        console.error("Error fetching document:", error);
        return null;
    }
};

export const readMultipleByIds = async (collectionName: string = 'questions', ids: string[]) => {
    try {
        // Create a query that matches multiple document IDs
        const q = query(collection(db, collectionName), where('__name__', 'in', ids));

        // Fetch the documents
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            // Return the documents as an array with their IDs
            return querySnapshot.docs.map((docSnap) => ({
                id: docSnap.id,
                ...docSnap.data(),
            }));
        } else {
            console.log("No documents found with the given IDs.");
            return [];
        }
    } catch (error) {
        console.error("Error fetching documents:", error);
        return [];
    }
};



// some actions

export const IncrementViews = async (postId: string) => {
    try {
        const postRef = doc(db, "questions", postId); // Reference to the specific post document

        // Increment the 'views' field by 1
        await updateDoc(postRef, {
            views: increment(1)
        });

        return true; // Indicate success
    } catch (error) {
        return false; // Indicate failure
    }
};

export const updatePost = async (collection = 'questions', id: string, updatedData: object) => {
    try {

        const postRef = doc(db, collection, id);
        await updateDoc(postRef, { ...updatedData });

        return true;
    } catch (error) {
        console.error("Error updating post:", error);
        return false;
    }
};



export const AnswerManagement = async (
    collection: string = "questions",
    id: string,
    updateType: "answer" | 'deleteAnswer' | 'editAnswer' | 'reply',
    answerId: string,
    data: reply = {},
    userId?: string,
) => {
    try {
        if (!id) throw new Error("Id not found");

        console.log(id);
        const postRef = doc(db, collection, id);

        if (updateType === "answer") {
            await updateDoc(postRef, {
                answers: arrayUnion(data),
            });
            return true
        }

        const postSnap = await getDoc(postRef);
        const postData = postSnap.data() as Question;


        let answers = postData?.answers || [];


    } catch (error) {
        console.error("Error updating answer:", error);
        return false;
    }
}

export const updatePostDetails = async (
    collection: string = "questions",
    id: string,
    updateType: "answer" | "like" | 'dislike' | "likeAnswer" | "unlikeAnswer" | 'likeReply',
    data: object = {},
    userId: string,
    answerId?: string,
    replyId?: string,
) => {
    try {
        if (!id) throw new Error("Id not found");
        if (!userId) router.push('./user/login');


        const postRef = doc(db, collection, id);

        if (updateType === "answer") {
            await updateDoc(postRef, {
                answers: arrayUnion(data),
            });
            return true
        }
        const postSnap = await getDoc(postRef);
        const postData = postSnap.data() as Question;


        if (!postSnap.exists()) {
            console.error("Post not found");
            return false;
        }

        const hasLiked = Array.isArray(postData.likes) ? postData.likes.some((like: any) => like.userId === userId) : false;
        const hasdisliked = Array.isArray(postData.dislikes) ? postData.dislikes.some((dislike: any) => dislike.userId === userId) : false;



        if (updateType === "like" && userId) {
            // Ensure user has not liked before

            if (!hasLiked) {
                await updateDoc(postRef, {
                    likes: arrayUnion({ userId }),
                });


            } else {
                await updateDoc(postRef, {
                    likes: arrayRemove({ userId }),
                });
            }
            await updateDoc(postRef, {
                dislikes: arrayRemove({ userId }),
            });

        } else if (updateType === "dislike" && userId) {
            if (!hasdisliked) {
                await updateDoc(postRef, {
                    dislikes: arrayUnion({ userId }),
                });
            } else {
                await updateDoc(postRef, {
                    dislikes: arrayRemove({ userId }),
                });
            }
            await updateDoc(postRef, {
                likes: arrayRemove({ userId }),
            });

        } else if ((updateType === "likeAnswer" || updateType === "unlikeAnswer") && userId && answerId) {
            // Find the answer in the array
            const updatedAnswers = postData.answers.map((answer: any) => {
                if (answer.id === answerId) {
                    const hasLiked = answer.likes?.some((like: any) => like.userId === userId);
                    if (updateType === "likeAnswer" && !hasLiked) {
                        return { ...answer, likes: [...(answer.likes || []), { userId }] };
                    } else {
                        return { ...answer, likes: answer.likes.filter((like: any) => like.userId !== userId) };
                    }
                }
                return answer;
            });

            // Update the post with modified answers
            await updateDoc(postRef, { answers: updatedAnswers });

        } else if ((updateType === "likeReply") && userId && answerId && replyId) {
            // Find the answer in the array
            const updatedAnswers = postData.answers.map((answer: answer) => {
                if (answer.id === answerId) {

                    const updatedReplys = answer.replies?.map((reply: reply) => {

                        if (reply.id === replyId) {
                            const hasLiked = reply.likes?.some((like: any) => like.userId === userId);
                            if (updateType === "likeReply" && !hasLiked) {
                                console.log({ ...reply, likes: [...(reply.likes || []), { userId }] });
                                return { ...reply, likes: [...(reply.likes || []), { userId }] };
                            } else {
                                return { ...reply, likes: reply.likes?.filter((like: any) => like.userId !== userId) || [] };
                            }
                        }
                        return reply;
                    });
                    return { ...answer, replies: updatedReplys };
                }
                return answer;
            });



            // Update the post with modified answers
            await updateDoc(postRef, { answers: updatedAnswers });
        }

        return true;
    } catch (error) {
        console.error("Error updating post:", error);
        return false;
    }
};




// users db

export const AddUser = async (userId: string, userData: object) => {
    try {
        const userRef = doc(db, "users", userId); // Custom ID
        await setDoc(userRef, userData, { merge: true });

        console.log("User added successfully with ID:", userId);
        return true;
    } catch (error) {
        console.error("Error adding user:", error);
        return false;
    }
};