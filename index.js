require('dotenv').config();

const path = require('path')
const express = require('express')
const cors = require('cors')
const connectDB = require('./src/config/db')
const router = require('./src/routes/leadsroutes')
const Userroute = require('./src/routes/userroutes')
const Taskroute = require('./src/routes/taskroutes')
const Ticketroute = require('./src/routes/ticketroutes')
const categories = require('./src/routes/categoriesroutes')
const notification = require('./src/routes/notificationRoutes')
const interview = require('./src/routes/interview')
const accessRoutes = require("./src/routes/access");
const checklists = require('./src/routes/checklistRoutes')
const { startTaskReminderCron } = require('./src/cronjob/taskReminder')
const { startChecklistScheduler } = require('./src/cronjob/checklistScheduler')

const app = express()
app.use(express.json())
app.use(cors())
app.use('/uploads', express.static(path.join(__dirname, 'public', 'Uploads')))

connectDB()


app.use('/leads', router)
app.use('/users', Userroute)
app.use('/task', Taskroute)
app.use('/ticket', Ticketroute)
app.use('/categories', categories)
app.use('/notification', notification)
app.use('/interview', interview)
app.use('/checklists', checklists)

app.use("/access", accessRoutes);



app.listen(5000, '0.0.0.0', () => {
    console.log('server is running on port 5000')
    startTaskReminderCron()
    startChecklistScheduler()
})
