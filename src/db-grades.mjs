import {AppError, CourseGrades} from 'course-grades';

import mongo from 'mongodb';

//use in mongo.connect() to avoid warning
const MONGO_CONNECT_OPTIONS = {useUnifiedTopology: true};

const GRADES_COLLECTION = 'grades';

export default class DBGrades {

    constructor(conn) {
        this._client = conn;
        this._delegate = null;
    }

    //factory method
    static async make(dbUrl) {
        try {
            let conn = await new mongo.MongoClient(dbUrl, MONGO_CONNECT_OPTIONS).connect();
            return new DBGrades(conn);
        } catch (e) {
            return {
                errors: [
                    new AppError(`DB: cannot connect to URL "${dbUrl}"`,
                        {
                            code: 'BAD_VAL', widget: e
                        }
                    )
                ]
            }
        }
    }

    /** Release all resources held by this instance.
     *  Specifically, close any database connections.
     */
    async close() {
        try {
            this._delegate = null;
            await this._client.close();
        } catch (e) {
            return {
                errors: [
                    new AppError(`DB: cannot close connection`,
                        {
                            code: 'BAD_VAL', widget: e
                        }
                    )
                ]
            }
        }
    }


    /** set all grades for courseId to rawGrades */
    async import(courseInfo, rawGrades) {
        try {
            // let connection = await this._client.connect();
            let db = await this._client.db();
            let collection = db.collection(GRADES_COLLECTION);
            // let insertValues = [];
            // for (let i of rawGrades) {
            //     insertValues.push({
            //         courseInfo,
            //         ...i
            //     })
            // }
            await collection.updateOne({
                _id: courseInfo.id
            }, {
                $set: {
                    _id: courseInfo.id,
                    grades: rawGrades
                }
            }, {
                upsert: true
            });
        } catch (e) {
            return {
                errors: [
                    new AppError(`DB: cannot import course with id ${courseInfo.id}`,
                        {
                            code: 'BAD_VAL', widget: rawGrades
                        }
                    )
                ]
            }
        }
    }

    /** add list of [emailId, colId, value] triples to grades for
     *  courseId, replacing previous entries if any.
     */
    async add(courseInfo, triples) {
        try {
            // let db = await this._client.db();
            // let collection = db.collection(GRADES_COLLECTION);
            // let key = "grades.$." + triples[1];
            // console.log(key, triples, triples[1]);
            // // await collection.bulkWrite(
            // //     [
            // //         collection.updateOne({
            // //             "_id": courseInfo.id,
            // //             "grades.emailId": {"$ne": triples[0]},
            // //         }, {
            // //             $push: {"grades": {emailId: triples[0]}}
            // //         }),
            // //         collection.updateOne(
            // //             {
            // //                 "_id": courseInfo,
            // //                 "grades:.emailId": triples[0],
            // //             },
            // //             {
            // //                 $set: {
            // //                     ["grades.$." + key]: triples[2]
            // //                 }
            // //             }
            // //         )
            // //     ]
            // // )
            // console.log(triples);
            // console.log({
            //     "grades.$.emailId": triples[0],
            //     [key]: triples[2],
            // });
            // await collection.update(
            //     {
            //         "_id": courseInfo.id,
            //         "grades.emailId": triples[0]
            //     },
            //     {
            //         $set: {
            //             "grades.$.emailId": triples[0],
            //             [key]: triples[2],
            //         }
            //     },
            //     {
            //         upsert: true
            //     }
            // )
            let raw = await this.raw(courseInfo);
            if (raw.errors) {
                return raw
            }
            let cs = new CourseGrades(courseInfo, raw);
            cs = cs.add(triples);
            if (cs.errors) {
                return cs;
            }
            raw = await this.import(courseInfo, cs.raw()) ?? {};
            if (raw.errors) {
                return raw
            }
        } catch (errors) {
            return {
                errors: [
                    new AppError(`DB: cannot add data to course ${courseInfo.id}`,
                        {
                            code: 'BAD_VAL', widget: triples
                        }
                    )
                ]
            }
        }
    }

    /** Clear out all courses */
    async clear() {
        //@TODO
        this._delegate = null;
        try {
            let db = await this._client.db();
            let collection = db.collection(GRADES_COLLECTION);
            await collection.drop();
        } catch (e) {
            return {
                errors: [
                    new AppError(`DB: cannot clear course`,
                        {
                            code: 'BAD_VAL', widget: e
                        }
                    )
                ]
            }
        }
    }

    /** return grades for courseId including stats.  Returned
     *  grades are filtered as per options.selectionSpec and
     *  projected as per options.projectionSpec.
     */
    async query(courseInfo, options) {
        //@TODO
        // const { projectionSpec=[], selectionSpec={} } = options;
        // let projections = projectionSpec.reduce((obj, item) => ({obj: 1}) ,{});
        // try {
        //     let connection = await this._client.connect();
        //     let db = await connection.db();
        //     let collection = db.collection(GRADES_COLLECTION);
        //     return await collection.find({
        //         "_id": courseInfo.id,
        //         ...selectionSpec
        //     }, projections)
        // } catch (e) {
        //     return {
        //         errors: [
        //             new AppError(`DB: cannot query grades of course ${courseInfo.id}`,
        //                 {
        //                     code: 'BAD_VAL', widget: options
        //                 }
        //             )
        //         ]
        //     }
        // }
        let result = await this.raw(courseInfo);
        if (result.errors) {
            return result;
        }
        this._delegate = new CourseGrades(courseInfo, result);
        return this._delegate.query(options)
    }

    /** return raw grades without stats for courseId */
    async raw(courseInfo) {
        try {
            let db = await this._client.db();
            let collection = db.collection(GRADES_COLLECTION);
            let re = await collection.findOne({"_id": courseInfo.id});
            return re.grades;
        } catch (e) {
            return {
                errors: [
                    new AppError(`DB: cannot get raw grades of course ${courseInfo.id}`,
                        {
                            code: 'BAD_VAL', widget: e
                        }
                    )
                ]
            }
        }
    }

}

