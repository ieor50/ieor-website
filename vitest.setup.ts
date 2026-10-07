// Load env the same way Next does locally (.env.local from vercel env pull)
import { config } from 'dotenv'

config({ path: ['.env.local', '.env'] })
