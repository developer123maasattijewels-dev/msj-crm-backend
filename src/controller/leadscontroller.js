const mongoose = require("mongoose")
const leadsmodel = require("../models/Leads")





const addLeads = async (req, res) => {
    try {

        const {
            name, email, phone, source, interestedProduct, status, assignedTo, notes
        } = req.body


        const newlead = await leadsmodel.create({
            name,
            email,
            phone,
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


const getLeads = async (req, res) => {
    try {
        const get = await leadsmodel.find()
        res.status(200).json({ message: 'Leads Get Successfully', Leads: get })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
}
const getLeadsId = async (req, res) => {
    try {
        const { id } = req.params
        const get = await leadsmodel.findById(id)
        res.status(200).json({ message: 'Leads Get id  Successfully', Leads: get })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
}




const updateLeads = async (req, res) => {
    try {
        const { id } = req.params;

        const allowedFields = [
            'name',
            'email',
            'phone',
            'source',
            'interestedProduct',
            'status',
            'assignedTo',
            'notes'
        ];

        const updates = {};

        // Only accept allowed fields
        for (const field of allowedFields) {
            if (
                Object.prototype.hasOwnProperty.call(
                    req.body || {},
                    field
                )
            ) {
                updates[field] = req.body[field];
            }
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid fields provided'
            });
        }

        // Get existing lead before updating
        const oldLead = await leadsmodel.findById(id);

        if (!oldLead) {
            return res.status(404).json({
                success: false,
                message: 'Lead not found'
            });
        }

        // Compare old and new values
        const changes = [];

        for (const field of Object.keys(updates)) {
            const oldValue = oldLead.get(field);
            const newValue = updates[field];

            if (
                String(oldValue ?? '') !==
                String(newValue ?? '')
            ) {
                changes.push({
                    field,
                    oldValue: oldValue ?? null,
                    newValue: newValue ?? null
                });
            }
        }

        // Update the lead
        const updatedLead = await leadsmodel.findByIdAndUpdate(
            id,
            { $set: updates },
            {
                new: true,
                runValidators: true
            }
        );

        // Save history only if something changed
        if (changes.length > 0) {
            await leadsmodel.create({
                leadId: updatedLead._id,
                changes,
                changedBy: req.user?.name || 'System'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Lead updated successfully',
            leadsdata: updatedLead,
            changes
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


const leadsDelete = async (req, res) => {
    try {
        const { id } = req.params
        const delet = await leadsmodel.findByIdAndDelete(id)
        res.status(200).json({ message: 'Leads delete succuessfully', Leads: delet })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
}



const leadsfilter = async (req, res) => {
    try {
        const { source, assignedTo, status, date } = req.query;

        const filter = {};

        if (source && source !== 'all') {
            filter.source = source;
        }

        if (assignedTo && assignedTo !== 'all') {
            filter.assignedTo = assignedTo;
        }

        if (status && status !== 'all') {
            filter.status = status;
        }

        if (date) {
            const startDate = new Date(`${date}T00:00:00.000Z`);

            if (
                Number.isNaN(startDate.getTime()) ||
                startDate.toISOString().slice(0, 10) !== date
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid date format. Use YYYY-MM-DD'
                });
            }

            const endDate = new Date(startDate);
            endDate.setUTCDate(endDate.getUTCDate() + 1);

            filter.createdAt = {
                $gte: startDate,
                $lt: endDate
            };
        }

        const leads = await leadsmodel
            .find(filter)
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            total: leads.length,
            leads
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


const searchLeads = async (req, res) => {
    try {
        const { search } = req.query;

        if (!search || !search.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a search value'
            });
        }

        const searchRegex = new RegExp(
            search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
            'i'
        );

        const leads = await leadsmodel.find({
            $or: [
                { name: searchRegex },
                { email: searchRegex },
                { phone: searchRegex },
                { interestedProduct: searchRegex }
            ]
        }).sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            total: leads.length,
            leads
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


const getLeadHistory = async (req, res) => {
    try {
        const { leadId } = req.params;

        if (!mongoose.isValidObjectId(leadId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid lead ID'
            });
        }

        const history = await leadsmodel.find({ leadId })
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            total: history.length,
            history
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};





module.exports = { addLeads, getLeads, getLeadsId, updateLeads, leadsDelete, leadsfilter, searchLeads , getLeadHistory }