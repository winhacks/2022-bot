import {Collection} from "discord.js";
import {
    MongoClient,
    Collection as MongoCollection,
    Document,
    UpdateFilter,
} from "mongodb";
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

// HACK: Create actual schema type instead of using MongoDB's base Document type

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

// Performs an operation under the safety of a transaction. Auto-commits after operation success.
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

    const result = await db.findOne(query);
    return result as T | null;
};

// finds and replaces a document matching the query inside the named collection
export const FindAndReplace = async <T>(
    collection: string,
    find: T | Query,
    replaceWith: T,
    required?: boolean
): Promise<boolean> => {
    const db = await GetClient(collection);

    const result = await db.findOneAndReplace(find, replaceWith);
    return !!result.ok && (!required || result.lastErrorObject?.updatedExisting);
};

// finds a document and applies the update to it
export const FindAndUpdate = async <T>(
    collection: string,
    find: T | Query,
    update: UpdateFilter<Document>,
    required?: boolean
): Promise<boolean> => {
    const db = await GetClient(collection);

    const result = await db.findOneAndUpdate(find, update);
    return !!result.ok && (!required || result.lastErrorObject?.updatedExisting);
};

export const FindAndUpdateAll = async <T>(
    collection: string,
    find: T | Query,
    update: UpdateFilter<Document>,
    required?: boolean
) => {
    const db = await GetClient(collection);

    const result = await db.updateMany(find, update);
    return !!result.acknowledged && (!required || result.matchedCount != 0);
};

// finds and removes a document matching the query from the named collection
export const FindAndRemove = async <T>(
    collection: string,
    toDelete: T | Query,
    required?: boolean
): Promise<boolean> => {
    const db = await GetClient(collection);

    const result = await db.findOneAndDelete(toDelete);
    return !!result.ok && (!required || result.lastErrorObject?.updatedExisting);
};
