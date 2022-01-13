import {Collection} from "discord.js";
import {MongoClient, Collection as MongoCollection, Document} from "mongodb";
import {Config} from "../config";
import {Query} from "../types";

// TODO: implement transaction safety methods for non-atomic operations
// StartTransaction => [session, client] and
// EndTransaction(session, client) => boolean, perhaps

let mongoClient: MongoClient;
const collectionCache: Collection<string, MongoCollection<Document>> = new Collection<
    string,
    MongoCollection<Document>
>();

export const teamCollection = "teams";
export const categoryCollection = "channelCategories";
export const verifiedCollection = "verifiedUsers";
export const inviteCollection = "invites";

export const AuthenticateMongo = async () => {
    mongoClient = new MongoClient(Config.mongo_db.database_url, {
        cert: Config.mongo_db.certificate,
        key: Config.mongo_db.private_key,
    });

    await mongoClient.connect();
    process.addListener("beforeExit", () => {
        mongoClient.close();
    });
};

export const GetClient = async (name: string) => {
    // try cache
    const cached = collectionCache.get(name);
    if (cached) {
        return cached;
    }

    // cache miss, find existing collection in database
    const db = mongoClient.db(Config.teams.database_name);
    const collections = await db.listCollections({name: name}).toArray();

    let collection;

    // create new collection if it doesn't exist
    if (collections.length == 0) {
        collection = await db.createCollection(name);
    } else {
        collection = db.collection(name);
    }

    // add collection into cache for fast access in the future
    collectionCache.set(name, collection);
    return collection;
};

export const InsertOne = async <T>(collection: string, toInsert: T): Promise<boolean> => {
    const db = await GetClient(collection);
    const result = await db.insertOne(toInsert);

    return result.acknowledged;
};

export const FindOne = async <T>(collection: string, query: Query): Promise<T | null> => {
    const db = await GetClient(collection);

    const res = await db.findOne(query);
    return res as T | null;
};

export const FindAndReplace = async <T>(
    collection: string,
    find: T | Query,
    replaceWith: T
): Promise<boolean> => {
    const db = await GetClient(collection);

    const result = await db.findOneAndReplace(find, replaceWith);
    return !!result.ok;
};

export const FindAndRemove = async <T>(
    collection: string,
    toDelete: T | Query
): Promise<boolean> => {
    const db = await GetClient(collection);

    const result = await db.findOneAndDelete(toDelete);
    return !!result.ok;
};
