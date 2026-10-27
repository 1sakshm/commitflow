import mongoose from 'mongoose'

const preferenceSchema = new mongoose.Schema(
  {
    repositoryDirectories: { type: [String], default: [] },
    theme: { type: String, enum: ['dark', 'light'], default: 'dark' }
  },
  { timestamps: true }
)

preferenceSchema.statics.current = async function () {
  return (await this.findOne()) || this.create({})
}

export default mongoose.model('Preference', preferenceSchema)
