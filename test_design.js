const ejs = require('ejs');
const fs = require('fs');

const dummyData = {
    fromName: "John Doe",
    companyName: "Dovetail Solutions",
    companyAddress: "123 Business Avenue",
    toName: "Jane Smith",
    toAddress: "456 Client Street",
    contactNumber: "+91 98765 43210",
    category: "Software Services",
    subCategory: "App Development",
    amount: "50,000",
    finalAmount: "50,000",
    notes: "Detailed notes here."
};

ejs.renderFile('./src/ejs/template.ejs', dummyData, (err, str) => {
    if (err) console.error(err);
    else fs.writeFileSync('./src/ejs/preview.html', str); // writes exactly what it looks like
    console.log("HTML generated successfully! You can now open src/ejs/preview.html");
});
