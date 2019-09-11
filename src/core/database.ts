import assert from 'assert'
import mongoose from 'mongoose'

const mongodbURI: string = process.env.MONGODB_URI!
assert(mongodbURI, 'MONGODB_URI is missing')
let cachedDB: mongoose.Connection | null = null

export interface User {
  userID: number
  username: string
  token: string
  tokenExpiresAt: Date
  serviceCode: string
  isCoupon: boolean
  dataCap: number
  usage: number
  autoSwitch: boolean
  lastUpdate: Date
  lastCheck: Date
}

export interface UserDocument extends mongoose.Document, User {}

export async function connectToDatabase() {
  if (cachedDB) {
    return cachedDB
  }

  const client = await mongoose.createConnection(mongodbURI, {
    bufferCommands: false, // Disable mongoose buffering
    bufferMaxEntries: 0, // and MongoDB driver buffering
    useNewUrlParser: true,
  })

  const User = client.model<UserDocument>(
    'User',
    new mongoose.Schema({
      userID: Number,
      username: String,
      token: String,
      tokenExpiresAt: Date,
      serviceCode: String,
      isCoupon: { type: Boolean, default: false },
      autoSwitch: { type: Boolean, default: true },
      dataCap: Number,
      usage: Number,
      lastUpdate: { type: Date, default: Date.now() }, // last time dataCap is calculated
      lastCheck: { type: Date, default: Date.now() }, // last time periodic job is invoked
    })
  )

  cachedDB = client
  return client
}

export async function createUser(userData: User) {
  const db = await connectToDatabase()
  const User = db.model('User')
  const user = new User(userData)
  const resp = await user.save()

  return resp
}

export async function getUser(userID: number) {
  const db = await connectToDatabase()
  const User = db.model<UserDocument>('User')
  const user = await User.findOne({ userID })

  return user
}

export async function getAllUsers() {
  const db = await connectToDatabase()
  const User = db.model<UserDocument>('User')
  const users = await User.find()

  return users
}

export async function closeConnection() {
  if (cachedDB) {
    return cachedDB.close()
  }
}
