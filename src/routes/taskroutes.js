const express = require('express');
const {
    add,
    getTask,
    getById,
    update,
    updateStatus,
    deleteTask,
    seedTasks
} = require('../controller/taskcontroller');

const router = express.Router();

router.post('/addtask', add);
router.post('/add', add);
router.get('/get', getTask);
router.get('/get/:id', getById);
router.put('/update/:id', update);
router.patch('/update/:id', update);
router.patch('/status/:id', updateStatus);
router.delete('/delete/:id', deleteTask);
// router.post('/seed', seedTasks);

module.exports = router;