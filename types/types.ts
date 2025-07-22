import { User } from "firebase/auth"

export type reply = {
    reply?: string,
    photoURL?: string,
    displayName?: string,
    uid?: string,
    id?: string,
    created_at?: string,
    likes?: object[]
}

export type answer = {
    answer: string,
    created_at: string,
    displaName: string,
    id: string,
    uid: string,
    replies: reply[],
    likes: object[],
}
export type user = {
    uid: string,
    displayName?: string,
    photoURL?: string,
    phoneNumber?: string,
    email?: string,
    trusted?: [],
    bio?: string

}
export type Question = {
    question: string,
    views: number,
    likes: object[],
    dislikes: object[],
    user: string,
    category: string,
    tags: object[],
    answers: answer[],
    created_at: string,
    id: string,
    image: string | null,
    reposts: [],
    reposting: string | null
    mentionProduct: string | null
}
export type Settings = {
    version?: String,
    notifications?: boolean,
    theme?: 'device' | 'light' | 'dark',
    fontsize?: 1 | 2 | 3 | 4 | 5 | 7,
}

export type Product = {
    product_name: string,
    description: string,
    price: string,
    condition: string,
    brand: string,
    location: string,
    category: string,
    rating: [],
    supplier: string,
    images: string[],
    id: string,
    isAd: string,
    created_at: string | undefined,
    reviews: [],
    additionalCosts: additionalCost[],
    per: string,
    booking: boolean
}

export type additionalCost = {
    id: string,
    name: string,
    value: string
}

export type advert = {
    id: string,
    link: string,
    images: string[],
    description: string,
    userID: string, created_at: string
}
export type cartProduct = {
    productData: Product,
    count: number
}

export type OrderItem = Product & {
    quantity: number;
    bookingStatus?: 'pending' | 'approved' | 'rejected'; 
}

export type Order = {
    id: string; 
    userId: string; 
    items: OrderItem[]; 
    deliveryAddress: string; 
    phoneNumber: string; 
    notes?: string; 
    total: number; 
    status: 'pending' | 'completed' | 'canceled'; 
    createdAt: string; 
}