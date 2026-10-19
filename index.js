require('dotenv').config();

const express = require('express')
const cors = require('cors')
const connectDB = require('./src/config/db')
const router = require('./src/routes/leadsroutes')
const Userroute = require('./src/routes/userroutes')
const Taskroute = require('./src/routes/taskroutes')

const app = express()
app.use(express.json())
app.use(cors())

connectDB()


app.use('/leads', router)
app.use('/users', Userroute)
app.use('/task', Taskroute)


app.listen(5000, () => {
    console.log('server is running on port 5000')
})
