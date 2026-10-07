// Load env for int tests (.env.local holds the Vercel-pulled secrets).
import { config } from 'dotenv'

config({ path: ['.env.local', '.env'] })
