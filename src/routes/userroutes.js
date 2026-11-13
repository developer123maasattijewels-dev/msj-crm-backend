const express = require('express');
const authenticateUser = require('../middleware/authenticateUser');
const {
    add,
    get,
    getByid,
    deleteUsers,
    update,
    login,
    registerAdmin,
    loginAdmin
} = require('../controller/Users');
const {
    getEmailProfile,
    updateEmailProfile,
    testEmailProfile,
    requireEmailProfileAccess
} = require('../controller/profileController');

const router = express.Router();

router.post('/login', login);
router.post('/add', add);
router.post('/register', registerAdmin);
router.post('/admin/register', registerAdmin);
router.post('/admin/login', loginAdmin);

router.get('/email-profile', getEmailProfile);
router.put('/email-profile', authenticateUser, requireEmailProfileAccess, updateEmailProfile);
router.post('/email-profile/test', authenticateUser, requireEmailProfileAccess, testEmailProfile);

router.get('/', get);
router.get('/users', get);
router.get('/profile/:id', getByid);
router.get('/users/:id', getByid);
router.get('/:id', getByid);
router.delete('/deleteuser/:id', deleteUsers);
router.delete('/:id', deleteUsers);
router.put('/profile/:id', update);
router.put('/updateuser/:id', update);
router.put('/:id', update);

module.exports = router;
