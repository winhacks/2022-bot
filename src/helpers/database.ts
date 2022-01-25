import {Client, Collection, Message, MessageEmbed} from "discord.js";
import {
    MongoClient,
    Collection as MongoCollection,
    Document,
    UpdateFilter,
    ClientSession,
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
    if (Config.dev_mode) {
        name += "_development";
    }

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
export const WithTransaction = async (operation: {
    (session: ClientSession): Promise<boolean>;
}) => {
    const session = mongoClient.startSession();

    let res = true;
    try {
        await session.withTransaction(async () => {
            res = await operation(session);
            if (!res) {
                await session.abortTransaction();
                return;
            }
        });
    } catch (err) {
        res = false;
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
    } finally {
        await session.endSession();
    }

    return res;
};

// inserts a document into the named collection
export const InsertOne = async <T>(
    collection: string,
    toInsert: T,
    options?: Partial<{session: ClientSession}>
): Promise<boolean> => {
    const db = await GetClient(collection);
    const result = await db.insertOne(toInsert, {session: options?.session});

    return result.acknowledged;
};

// returns a document matching the query inside the named collection
export const FindOne = async <T>(
    collection: string,
    query: Query,
    options?: Partial<{session: ClientSession}>
): Promise<T | null> => {
    const db = await GetClient(collection);

    const result = await db.findOne(query, {session: options?.session});
    return result as T | null;
};

// finds and replaces a document matching the query inside the named collection
export const FindAndReplace = async <T>(
    collection: string,
    find: T | Query,
    replaceWith: T,
    options?: Partial<{session: ClientSession; required: boolean}>
): Promise<boolean> => {
    const db = await GetClient(collection);
    const result = await db.findOneAndReplace(find, replaceWith, {
        session: options?.session,
    });
    return !!result.ok && !(options?.required ?? true);
};

// finds a document and applies the update to it
export const FindAndUpdate = async <T>(
    collection: string,
    find: T | Query,
    update: UpdateFilter<Document> | Partial<T>,
    options?: Partial<{session: ClientSession; required: boolean; upsert: boolean}>
): Promise<boolean> => {
    const upsert = options?.upsert ?? false;
    const db = await GetClient(collection);
    const result = await db.updateOne(find, update, {
        upsert: upsert,
        session: options?.session,
    });

    return !!result.acknowledged || !(options?.required ?? true);
};

export const FindAndUpdateAll = async <T>(
    collection: string,
    find: T | Query,
    update: UpdateFilter<Document>,
    options?: Partial<{session: ClientSession; required: boolean}>
) => {
    const db = await GetClient(collection);
    const result = await db.updateMany(find, update, {session: options?.session});
    return (
        (!!result.acknowledged && result.matchedCount !== 0) ||
        !(options?.required ?? true)
    );
};

// finds and removes a document matching the query from the named collection
export const FindAndRemove = async <T>(
    collection: string,
    toDelete: T | Query,
    options?: Partial<{session: ClientSession; required: boolean}>
): Promise<boolean> => {
    const db = await GetClient(collection);
    const result = await db.findOneAndDelete(toDelete, {session: options?.session});
    return !!result.ok || !(options?.required ?? true);
};
