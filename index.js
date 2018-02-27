'use strict';

const express = require('express');
const xero = require('xero-node');
const exphbs = require('express-handlebars');
const fs = require('fs');

var xeroClient;
var eventReceiver;
var metaConfig = {};

var app = express();

var exbhbsEngine = exphbs.create({
    defaultLayout: 'main',
    layoutsDir: __dirname + '/views/layouts',
    partialsDir: [
        __dirname + '/views/partials/'
    ],
    helpers: {
        ifCond: function(v1, operator, v2, options) {

            switch (operator) {
                case '==':
                    return (v1 == v2) ? options.fn(this) : options.inverse(this);
                case '===':
                    return (v1 === v2) ? options.fn(this) : options.inverse(this);
                case '!=':
                    return (v1 != v2) ? options.fn(this) : options.inverse(this);
                case '!==':
                    return (v1 !== v2) ? options.fn(this) : options.inverse(this);
                case '<':
                    return (v1 < v2) ? options.fn(this) : options.inverse(this);
                case '<=':
                    return (v1 <= v2) ? options.fn(this) : options.inverse(this);
                case '>':
                    return (v1 > v2) ? options.fn(this) : options.inverse(this);
                case '>=':
                    return (v1 >= v2) ? options.fn(this) : options.inverse(this);
                case '&&':
                    return (v1 && v2) ? options.fn(this) : options.inverse(this);
                case '||':
                    return (v1 || v2) ? options.fn(this) : options.inverse(this);
                default:
                    return options.inverse(this);
            }
        },
        debug: function(optionalValue) {
            console.log("Current Context");
            console.log("====================");
            console.log(this);

            if (optionalValue) {
                console.log("Value");
                console.log("====================");
                console.log(optionalValue);
            }
        }
    }
});

app.engine('handlebars', exbhbsEngine.engine);

app.set('view engine', 'handlebars');
app.set('views', __dirname + '/views');

app.use(express.logger());
app.use(express.bodyParser());

app.set('trust proxy', 1);

app.use(express.static(__dirname + '/assets'));

function getXeroClient() {
    metaConfig = require('./config/config.json');

    var APPTYPE = metaConfig.APPTYPE;
    var config = metaConfig[APPTYPE.toLowerCase()];

    if (config.privateKeyPath && !config.privateKey) {
        try {
            //Try to read from the path
            config.privateKey = fs.readFileSync(config.privateKeyPath);
        } catch (ex) {
            //It's not a path, so use the consumer secret as the private key
            config.privateKey = "";
        }
    }

    switch (APPTYPE) {
        case "PUBLIC":
            xeroClient = new xero.PublicApplication(config);
            break;
        case "PARTNER":
            xeroClient = new xero.PartnerApplication(config);
            eventReceiver = xeroClient.eventEmitter;
            eventReceiver.on('xeroTokenUpdate', function(data) {
                //Store the data that was received from the xeroTokenRefresh event
                console.log("Received xero token refresh: ", data);
                console.log("Store this in a DB");
                debugger;



                // Now that that data was store in a DB use it to create a new SdK object

                let newXeroClient = new xero.PartnerApplication(config);
                newXeroClient.setOptions(data);

                newXeroClient.core.users.getUsers()
                    .then(function(users) {
                      console.log('USERS: ', users);
                    })
                    .catch(function(err) {
                        handleErr(err, req, res, 'users');
                    })


            });
            break;
        default:
            throw "No App Type Set!!"
    }
    return xeroClient;
}

function authorizeRedirect(req, res, returnTo) {
    var xeroClient = getXeroClient();
    xeroClient.getRequestToken(function(err, token, secret) {
        if (!err) {
            //Note: only include this scope if payroll is required for your application.
            var PayrollScope = 'payroll.employees,payroll.payitems,payroll.timesheets';
            var AccountingScope = '';

            var authoriseUrl = xeroClient.buildAuthorizeUrl(token, {
                scope: AccountingScope
            });
            res.redirect(authoriseUrl);
        } else {
            res.redirect('/error');
        }
    })
}

function handleErr(err, req, res, returnTo) {
    console.log(err);
    if (err.data && err.data.oauth_problem && err.data.oauth_problem == "token_rejected") {
        authorizeRedirect(req, res, returnTo);
    } else {
        res.redirect('error', err);
    }
}

app.get('/error', function(req, res) {
    console.log(req.query.error);
    res.render('index', { error: req.query.error });
})

// Home Page
app.get('/', function(req, res) {
    res.render('index', {
        active: {
            overview: true
        }
    });
});

// Redirected from xero with oauth results
app.get('/access', function(req, res) {
    if (req.query.oauth_verifier && req.query.oauth_token) {
        xeroClient.setAccessToken(req.query.oauth_token, req.query.oauth_token_secret, req.query.oauth_verifier)
            .then(function(token) {
                res.redirect('/');
            })
            .catch(function(err) {
                handleErr(err, req, res, 'error');
            })
    }
});

app.get('/organisations', function(req, res) {
    authorizeRedirect(req, res, '/brandingthemes');
});

app.get('/brandingthemes', function(req, res) {

    let resss = xeroClient.refreshAccessToken().
        then(function(rrr) {
            debugger;
            return xeroClient.core.brandingThemes.getBrandingThemes()
                .then(function(brandingthemes) {
                    res.render('brandingthemes', {
                        brandingthemes: brandingthemes,
                        active: {
                            brandingthemes: true,
                            nav: {
                                accounting: true
                            }
                        }
                    });
                })
                .catch(function(err) {
                    handleErr(err, req, res, 'brandingthemes');
                })
        })
})

app.get('/invoicereminders', function(req, res) {
    authorizedOperation(req, res, '/invoicereminders', function(xeroClient) {
        xeroClient.core.invoiceReminders.getInvoiceReminders()
            .then(function(invoiceReminders) {
                res.render('invoicereminders', {
                    invoicereminders: invoiceReminders,
                    active: {
                        invoicereminders: true,
                        nav: {
                            accounting: true
                        }
                    }
                });
            })
            .catch(function(err) {
                handleErr(err, req, res, 'invoicereminders');
            })
    })
});

app.get('/taxrates', function(req, res) {
    authorizedOperation(req, res, '/taxrates', function(xeroClient) {
        xeroClient.core.taxRates.getTaxRates()
            .then(function(taxrates) {
                res.render('taxrates', {
                    taxrates: taxrates,
                    active: {
                        taxrates: true,
                        nav: {
                            accounting: true
                        }
                    }
                });
            })
            .catch(function(err) {
                handleErr(err, req, res, 'taxrates');
            })
    })
});

app.get('/users', function(req, res) {
    authorizedOperation(req, res, '/users', function(xeroClient) {
        xeroClient.core.users.getUsers()
            .then(function(users) {
                res.render('users', {
                    users: users,
                    active: {
                        users: true,
                        nav: {
                            accounting: true
                        }
                    }
                });
            })
            .catch(function(err) {
                handleErr(err, req, res, 'users');
            })
    })
});

app.get('/contacts', function(req, res) {
    authorizedOperation(req, res, '/contacts', function(xeroClient) {
        var contacts = [];
        xeroClient.core.contacts.getContacts({ pager: { callback: pagerCallback } })
            .then(function() {
                res.render('contacts', {
                    contacts: contacts,
                    active: {
                        contacts: true,
                        nav: {
                            accounting: true
                        }
                    }
                });
            })
            .catch(function(err) {
                handleErr(err, req, res, 'contacts');
            })

        function pagerCallback(err, response, cb) {
            contacts.push.apply(contacts, response.data);
            cb()
        }
    })
});

app.get('/currencies', function(req, res) {
    authorizedOperation(req, res, '/currencies', function(xeroClient) {
        xeroClient.core.currencies.getCurrencies()
            .then(function(currencies) {
                res.render('currencies', {
                    currencies: currencies,
                    active: {
                        currencies: true,
                        nav: {
                            accounting: true
                        }
                    }
                });
            })
            .catch(function(err) {
                handleErr(err, req, res, 'currencies');
            });
    })
});

app.get('/banktransactions', function(req, res) {
    authorizedOperation(req, res, '/banktransactions', function(xeroClient) {
        var bankTransactions = [];
        xeroClient.core.bankTransactions.getBankTransactions({ pager: { callback: pagerCallback } })
            .then(function() {
                res.render('banktransactions', {
                    bankTransactions: bankTransactions,
                    active: {
                        banktransactions: true,
                        nav: {
                            accounting: true
                        }
                    }
                });
            })
            .catch(function(err) {
                handleErr(err, req, res, 'banktransactions');
            })

        function pagerCallback(err, response, cb) {
            bankTransactions.push.apply(bankTransactions, response.data);
            cb()
        }
    })
});

app.get('/journals', function(req, res) {
    authorizedOperation(req, res, '/journals', function(xeroClient) {
        var journals = [];
        xeroClient.core.journals.getJournals({ pager: { callback: pagerCallback } })
            .then(function() {
                res.render('journals', {
                    journals: journals,
                    active: {
                        journals: true,
                        nav: {
                            accounting: true
                        }
                    }
                });
            })
            .catch(function(err) {
                handleErr(err, req, res, 'journals');
            })

        function pagerCallback(err, response, cb) {
            journals.push.apply(journals, response.data);
            cb()
        }
    })
});

app.get('/banktransfers', function(req, res) {
    authorizedOperation(req, res, '/banktransfers', function(xeroClient) {
        var bankTransfers = [];
        xeroClient.core.bankTransfers.getBankTransfers({ pager: { callback: pagerCallback } })
            .then(function() {
                res.render('banktransfers', {
                    bankTransfers: bankTransfers,
                    active: {
                        banktransfers: true,
                        nav: {
                            accounting: true
                        }
                    }
                });
            })
            .catch(function(err) {
                handleErr(err, req, res, 'banktransfers');
            })

        function pagerCallback(err, response, cb) {
            bankTransfers.push.apply(bankTransfers, response.data);
            cb()
        }
    })
});

app.get('/payments', function(req, res) {
    authorizedOperation(req, res, '/payments', function(xeroClient) {
        xeroClient.core.payments.getPayments()
            .then(function(payments) {
                res.render('payments', {
                    payments: payments,
                    active: {
                        payments: true,
                        nav: {
                            accounting: true
                        }
                    }
                });
            })
            .catch(function(err) {
                handleErr(err, req, res, 'payments');
            })
    })
});

app.get('/trackingcategories', function(req, res) {
    authorizedOperation(req, res, '/trackingcategories', function(xeroClient) {
        xeroClient.core.trackingCategories.getTrackingCategories()
            .then(function(trackingcategories) {
                res.render('trackingcategories', {
                    trackingcategories: trackingcategories,
                    active: {
                        trackingcategories: true,
                        nav: {
                            accounting: true
                        }
                    }
                });
            })
            .catch(function(err) {
                handleErr(err, req, res, 'trackingcategories');
            })
    })
});

app.get('/accounts', function(req, res) {
    authorizedOperation(req, res, '/accounts', function(xeroClient) {
        xeroClient.core.accounts.getAccounts()
            .then(function(accounts) {
                res.render('accounts', {
                    accounts: accounts,
                    active: {
                        accounts: true,
                        nav: {
                            accounting: true
                        }
                    }
                });
            })
            .catch(function(err) {
                handleErr(err, req, res, 'accounts');
            })
    })
});

app.get('/creditnotes', function(req, res) {
    authorizedOperation(req, res, '/creditnotes', function(xeroClient) {
        xeroClient.core.creditNotes.getCreditNotes()
            .then(function(creditnotes) {
                res.render('creditnotes', {
                    creditnotes: creditnotes,
                    active: {
                        creditnotes: true,
                        nav: {
                            accounting: true
                        }
                    }
                });
            })
            .catch(function(err) {
                handleErr(err, req, res, 'creditnotes');
            })
    })
});

app.get('/invoices', function(req, res) {
    authorizedOperation(req, res, '/invoices', function(xeroClient) {
        xeroClient.core.invoices.getInvoices()
            .then(function(invoices) {
                res.render('invoices', {
                    invoices: invoices,
                    active: {
                        invoices: true,
                        nav: {
                            accounting: true
                        }
                    }
                });
            })
            .catch(function(err) {
                handleErr(err, req, res, 'invoices');
            })

    })
});

app.get('/repeatinginvoices', function(req, res) {
    authorizedOperation(req, res, '/repeatinginvoices', function(xeroClient) {
        xeroClient.core.repeatinginvoices.getRepeatingInvoices()
            .then(function(repeatingInvoices) {
                res.render('repeatinginvoices', {
                    repeatinginvoices: repeatingInvoices,
                    active: {
                        repeatinginvoices: true,
                        nav: {
                            accounting: true
                        }
                    }
                });
            })
            .catch(function(err) {
                handleErr(err, req, res, 'repeatinginvoices');
            })

    })
});

app.get('/attachments', function(req, res) {
    authorizedOperation(req, res, '/attachments', function(xeroClient) {

        var entityID = req.query && req.query.entityID ? req.query.entityID : null;
        var entityType = req.query && req.query.entityType ? req.query.entityType : null;

        if (entityID && entityType) {

            xeroClient.core.invoices.getInvoice(entityID)
                .then(function(invoice) {
                    invoice.getAttachments()
                        .then(function(attachments) {
                            res.render('attachments', {
                                attachments: attachments,
                                InvoiceID: entityID,
                                active: {
                                    invoices: true,
                                    nav: {
                                        accounting: true
                                    }
                                }
                            });
                        })
                        .catch(function(err) {
                            handleErr(err, req, res, 'attachments');
                        })
                })
                .catch(function(err) {
                    handleErr(err, req, res, 'attachments');
                })

        } else {
            handleErr("No Attachments Found", req, res, 'index');
        }
    })
});

app.get('/download', function(req, res) {
    authorizedOperation(req, res, '/attachments', function(xeroClient) {

        var entityID = req.query && req.query.entityID ? req.query.entityID : null;
        var entityType = req.query && req.query.entityType ? req.query.entityType : null;
        var fileId = req.query && req.query.fileId ? req.query.fileId : null;

        if (entityID && entityType && fileId) {

            xeroClient.core.invoices.getInvoice(entityID)
                .then(function(invoice) {
                    invoice.getAttachments()
                        .then(function(attachments) {
                            attachments.forEach(attachment => {
                                //Get the reference to the attachment object
                                if (attachment.AttachmentID === fileId) {
                                    res.writeHead(200, {
                                        "Content-Type": attachment.MimeType,
                                        "Content-Disposition": "attachment; filename=" + attachment.FileName,
                                        "Content-Length": attachment.ContentLength
                                    });
                                    attachment.getContent(res);
                                }
                            });
                        })
                        .catch(function(err) {
                            handleErr(err, req, res, 'attachments');
                        })
                })
                .catch(function(err) {
                    handleErr(err, req, res, 'attachments');
                })

        } else {
            handleErr("No Attachments Found", req, res, 'index');
        }
    })
});

app.get('/items', function(req, res) {
    authorizedOperation(req, res, '/items', function(xeroClient) {
        xeroClient.core.items.getItems()
            .then(function(items) {
                res.render('items', {
                    items: items,
                    active: {
                        items: true,
                        nav: {
                            accounting: true
                        }
                    }
                });
            })
            .catch(function(err) {
                handleErr(err, req, res, 'items');
            })

    })
});

app.get('/manualjournals', function(req, res) {
    authorizedOperation(req, res, '/manualjournals', function(xeroClient) {
        var manualjournals = [];
        xeroClient.core.manualjournals.getManualJournals({ pager: { callback: pagerCallback } })
            .then(function() {
                res.render('manualjournals', {
                    manualjournals: manualjournals,
                    active: {
                        manualjournals: true,
                        nav: {
                            accounting: true
                        }
                    }
                });
            })
            .catch(function(err) {
                handleErr(err, req, res, 'manualjournals');
            })

        function pagerCallback(err, response, cb) {
            manualjournals.push.apply(manualjournals, response.data);
            cb()
        }
    })
});

app.get('/reports', function(req, res) {
    authorizedOperation(req, res, '/reports', function(xeroClient) {

        var reportkeys = {
            '1': 'BalanceSheet',
            '2': 'TrialBalance',
            '3': 'ProfitAndLoss',
            '4': 'BankStatement',
            '5': 'BudgetSummary',
            '6': 'ExecutiveSummary',
            '7': 'BankSummary',
            '8': 'AgedReceivablesByContact',
            '9': 'AgedPayablesByContact',
            '10': 'TenNinetyNine'
        };

        var report = req.query ? req.query.r : null;

        if (reportkeys[report]) {
            var selectedReport = reportkeys[report];

            var data = {
                active: {
                    nav: {
                        reports: true
                    }
                }
            };

            data.active[selectedReport.toLowerCase()] = true;

            /**
             * We may need some dependent data:
             * 
             * BankStatement - requires a BankAccountId
             * AgedReceivablesByContact - requires a ContactId
             * AgedPayablesByContact - requires a ContactId
             * 
             */

            if (selectedReport == 'BankStatement') {
                xeroClient.core.accounts.getAccounts({ where: 'Type=="BANK"' })
                    .then(function(accounts) {
                        xeroClient.core.reports.generateReport({
                            id: selectedReport,
                            params: {
                                bankAccountID: accounts[0].AccountID
                            }
                        })
                            .then(function(report) {
                                data.report = report.toObject();
                                data.colspan = data.report.Rows[0].Cells.length;
                                res.render('reports', data);
                            })
                            .catch(function(err) {
                                handleErr(err, req, res, 'reports');
                            });
                    })
                    .catch(function(err) {
                        handleErr(err, req, res, 'reports');
                    });
            } else if (selectedReport == 'AgedReceivablesByContact' || selectedReport == 'AgedPayablesByContact') {
                xeroClient.core.contacts.getContacts()
                    .then(function(contacts) {
                        xeroClient.core.reports.generateReport({
                            id: selectedReport,
                            params: {
                                contactID: contacts[0].ContactID
                            }
                        })
                            .then(function(report) {
                                data.report = report.toObject();
                                data.colspan = data.report.Rows[0].Cells.length;
                                res.render('reports', data);
                            })
                            .catch(function(err) {
                                handleErr(err, req, res, 'reports');
                            });
                    })
                    .catch(function(err) {
                        handleErr(err, req, res, 'reports');
                    });
            } else {
                xeroClient.core.reports.generateReport({
                    id: selectedReport
                })
                    .then(function(report) {
                        data.report = report.toObject();
                        if (data.report.Rows) {
                            data.colspan = data.report.Rows[0].Cells.length;
                        }
                        res.render('reports', data);
                    })
                    .catch(function(err) {
                        handleErr(err, req, res, 'reports');
                    });
            }

        } else {
            res.render('index', {
                error: {
                    message: "Report not found"
                },
                active: {
                    overview: true
                }
            });
        }
    })
});

app.use('/createinvoice', function(req, res) {
    if (req.method == 'GET') {
        return res.render('createinvoice');
    } else if (req.method == 'POST') {
        authorizedOperation(req, res, '/createinvoice', function(xeroClient) {
            var invoice = xeroClient.core.invoices.newInvoice({
                Type: req.body.Type,
                Contact: {
                    Name: req.body.Contact
                },
                DueDate: '2014-10-01',
                LineItems: [{
                    Description: req.body.Description,
                    Quantity: req.body.Quantity,
                    UnitAmount: req.body.Amount,
                    AccountCode: 400,
                    ItemCode: 'ABC123'
                }],
                Status: 'DRAFT'
            });
            invoice.save()
                .then(function(ret) {
                    res.render('createinvoice', { outcome: 'Invoice created', id: ret.entities[0].InvoiceID })
                })
                .catch(function(err) {
                    res.render('createinvoice', { outcome: 'Error', err: err })
                })

        })
    }
});

app.use(function(req, res, next) {
    if (req.session)
        delete req.session.returnto;
})

var PORT = process.env.PORT || 3100;

app.listen(PORT);
console.log("listening on http://localhost:" + PORT);
