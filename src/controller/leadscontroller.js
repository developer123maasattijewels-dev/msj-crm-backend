const leadsmodel = require("../models/Leads")





    const addLeads = async (req, res) => {
        try {

            const {
                name, email, phone, source, interestedProduct, status, assignedTo, notes
            } = req.body



            const newlead = await leadsmodel.create({
                name,
                phone,
                email,
                source,
                interestedProduct,
                status,
                assignedTo,
                notes,
            })


            res.status(200).json({ message: 'Leads added Successfully', leadsdata: newlead })

        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message,
            });
        }

    }







module.exports = { addLeads }