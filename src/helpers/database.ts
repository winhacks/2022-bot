import {Collection} from "discord.js";
import {MongoClient, Collection as MongoCollection, Document} from "mongodb";
import {Config} from "../config";
import {Query} from "../types";

let mongoClient: MongoClient;
const collectionCache: Collection<string, MongoCollection<Document>> = new Collection<
    string,
    MongoCollection<Document>
>();

export const teamCollection = "teams";
export const categoryCollection = "team_categories";
export const verifiedCollection = "users";
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

// Performs an operation under the safety of a transaction
export const WithTransaction = async (operation: {(): Promise<boolean>}) => {
    const session = mongoClient.startSession();
    session.startTransaction();

    const success = await operation();
    if (success) {
        session.commitTransaction();
    } else {
        session.abortTransaction();
    }

    session.endSession();
    return success;
};

// inserts a document into the named collection
export const InsertOne = async <T>(collection: string, toInsert: T): Promise<boolean> => {
    const db = await GetClient(collection);
    const result = await db.insertOne(toInsert);

    return result.acknowledged;
};

// returns a document matching the query inside the named collection
export const FindOne = async <T>(collection: string, query: Query): Promise<T | null> => {
    const db = await GetClient(collection);

    const res = await db.findOne(query);
    return res as T | null;
};

// finds and replaces a document matching the query inside the named collection
export const FindAndReplace = async <T>(
    collection: string,
    find: T | Query,
    replaceWith: T
): Promise<boolean> => {
    const db = await GetClient(collection);

    const result = await db.findOneAndReplace(find, replaceWith);
    return !!result.ok;
};

// finds and removes a document matching the query from the named collection
export const FindAndRemove = async <T>(
    collection: string,
    toDelete: T | Query
): Promise<boolean> => {
    const db = await GetClient(collection);

    const result = await db.findOneAndDelete(toDelete);
    return !!result.ok;
};
