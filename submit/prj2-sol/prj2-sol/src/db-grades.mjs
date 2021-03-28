import { AppError, CourseGrades } from 'course-grades';

import mongo from 'mongodb';

//use in mongo.connect() to avoid warning
const MONGO_CONNECT_OPTIONS = { useUnifiedTopology: true };

const GRADES_COLLECTION = 'grades';

export default class DBGrades {
  constructor() {
    //@TODO
  }

  //factory method
  static async make(dbUrl) {
    //@TODO
    return new DBGrades();  //@TODO: add suitable args
  }

  /** Release all resources held by this instance.
   *  Specifically, close any database connections.
   */
  async close() {
    //@TODO
  }

  
  /** set all grades for courseId to rawGrades */
  async import(courseInfo, rawGrades) {
    //@TODO
  }

  /** add list of [emailId, colId, value] triples to grades for 
   *  courseId, replacing previous entries if any.
   */
  async add(courseInfo, triples) {
    //@TODO
  }

  /** Clear out all courses */
  async clear() {
    //@TODO
  }
  
  /** return grades for courseId including stats.  Returned
   *  grades are filtered as per options.selectionSpec and
   *  projected as per options.projectionSpec.
   */
  async query(courseInfo, options) {
    //@TODO
  }

  /** return raw grades without stats for courseId */
  async raw(courseInfo) { 
    //@TODO
  }

}

