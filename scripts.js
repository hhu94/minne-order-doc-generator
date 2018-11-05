class OrderSet {
    constructor(orderId, orders) {
        this.orderId = orderId;
        this.orders = orders;
    }
}

function generatePdf() {
    parseAndGenerate((orderSets, pdf) => {
        // Checklist
        let i = 1;
        let currentY = 25;
        orderSets.forEach(orderSet => {
            if (i === 1 || currentY > 274) {
                if (i > 1) {
                    pdf.addPage();
                }
                currentY = 25;
                pdf.line(20, currentY - 6, 190, currentY - 6);
            }
            pdf.text(20, currentY, `【${i}件目】 注文番号：${orderSet.orderId} ${orderSet.orders[0].配送先の氏名} 様`);
            pdf.line(20, currentY + 3, 190, currentY + 3);
            currentY += 10;
            i++;
        });

        pdf.addPage();
        i = 1;
        orderSets.forEach(orderSet => {
            if (i > 1) {
                pdf.addPage();
            }

            // Order slip
            pdf.text(20, 20, `【${i}件目】`);
            pdf.text(20, 30, [
                `注文番号：${orderSet.orderId}`,
                `お客様ID：${orderSet.orders[0].注文者のユーザーID}`,
                `ご注文日：${orderSet.orders[0].注文日}`
            ]);
            pdf.text(20, 50, [
                'この度は当ショップをご利用いただきありがとうございます。以下の通り納品させていただきます。',
                '■ご注文商品■'
            ]);
            currentY = 61;
            let total = 0;
            orderSet.orders.forEach(order => {
                const splitText = pdf.splitTextToSize(
                    `□個数：${order.数量} ${order.作品名} 単価：${order.販売価格}円 小計：${order.小計}円`,
                    170
                );
                pdf.text(20, currentY, splitText);
                currentY += 5.5 * splitText.length;
                if (currentY > 277) {
                    pdf.addPage();
                    currentY = 20;
                }
                total += parseInt(order.小計, 10);
            });
            pdf.text(20, currentY, `合計金額：${total}円`)

            // Destination address slip
            pdf.addPage();
            pdf.text(20, 20, `【${i}件目】`);
            pdf.text(20, 50, formatPostalCode(orderSet.orders[0].配送先の郵便番号));
            const splitAddressText = pdf.splitTextToSize(
                `${orderSet.orders[0].配送先の住所1} ${orderSet.orders[0].配送先の住所2}`,
                70
            );
            pdf.text(20, 55, splitAddressText);
            pdf.setFontSize(12);
            pdf.text(20, 62.5 + 5.5 * (splitAddressText.length - 1), `${orderSet.orders[0].配送先の氏名} 様`);
            pdf.setFontSize(10);
            i++;
        });
        pdf.save();
    });
}

function parseAndGenerate(generator) {
    const files = getFiles();
    if (files.length === 0) {
        alertAndThrow('注文一覧データのCSVファイルを選んでください');
    }
    fetch('sawarabi-gothic-base64.txt').then(response => response.text().then(font => {
        // Configure PDF settings
        const pdf = new jsPDF({lineHeight: 1.5});
        pdf.addFileToVFS('sawarabi-gothic-base64.txt', font)
        pdf.addFont('sawarabi-gothic-base64.txt', 'sawarabi-gothic', 'normal');
        pdf.setFont('sawarabi-gothic');
        pdf.setFontSize('10');

        // Parse CSV files
        Papa.parse(files[0], {
            header: true,
            complete: results => {
                if (files.length === 1) {
                    generator(processData(results.data), pdf);
                } else { // files.length === 2
                    Papa.parse(files[1], {
                        header: true,
                        complete: results2 => {
                            // Merge the data from both files, then process it as a whole
                            generator(processData(results.data.concat(results2.data)), pdf);
                        }
                    })
                }
            }
        });
    }));
}

function processData(orderData) {
    verifyHeaders(orderData[0]);
    const orderSets = orderData
        .filter(order => order.注文状況 === '発送準備中')
        .reduce((orderSets, order) => {
            const orderId = order.注文ID;
            if (orderSets.hasOwnProperty(orderId)) {
                orderSets[orderId].orders.push(order);
            } else {
                orderSets[orderId] = new OrderSet(orderId, [order]);
            }
            return orderSets;
        }, {});
    return Object.values(orderSets).sort((a, b) => a.orders[0].注文日.localeCompare(b.orders[0].注文日));
}

function verifyHeaders(order) {
    if (order.注文状況 == null
        || order.注文日 == null
        || order.配送先の住所1 == null
        || order.配送先の住所2 == null
        || order.注文ID == null
        || order.注文者のユーザーID == null
        || order.数量 == null
        || order.作品名 == null
        || order.販売価格 == null
        || order.小計 == null
        || order.配送先の郵便番号 == null
        || order.配送先の氏名 == null
    ) {
        alertAndThrow('エラーが発生しました：An expected header is missing in one of the provided files.');
    }
}

function getFiles() {
    const file1 = document.getElementById('selectFile1');
    const file2 = document.getElementById('selectFile2');
    let res = [];
    if (file1 && file1.files[0]) {
        res = res.concat(file1.files[0]);
    }
    if (file2 && file2.files[0]) {
        res = res.concat(file2.files[0]);
    }
    return res;
}

function alertAndThrow(errorMessage) {
    alert(errorMessage);
    throw new Error(errorMessage);
}

function formatPostalCode(postalCode) {
    return `〒${postalCode.substring(0, 3)}-${postalCode.substring(3)}`;
}