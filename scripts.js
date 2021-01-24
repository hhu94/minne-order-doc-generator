class OrderSet {
    constructor(orderId, orders) {
        this.orderId = orderId;
        this.orders = orders;
    }
}

async function generatePdf() {
    const logo = await (await fetch('logo-base64.txt')).text();
    await parseAndGenerate((orderSets, pdf) => {
        // Checklist
        let i = 1;
        let currentX = 20;
        let currentY = 25;
        orderSets.forEach(orderSet => {
            if (i === 1 || currentY > 274) {
                if (i > 1) {
                    pdf.addPage();
                }
                currentY = 25;
                pdf.line(currentX, currentY - 6, 190, currentY - 6);
            }
            pdf.text(currentX, currentY, `【${i}件目】 注文番号：${orderSet.orderId} ${orderSet.orders[0].配送先の氏名} 様`);
            pdf.line(currentX, currentY + 3, 190, currentY + 3);
            currentY += 10;
            i++;
        });

        // Order slips
        pdf.addPage();
        i = 1;
        currentX = 20;
        orderSets.forEach(orderSet => {
            if (i > 1) {
                pdf.addPage();
            }
            currentY = 20;
            pdf.text(currentX, currentY, `【${i}件目】`);
            currentY += 10 + getLineHeight(pdf);
            pdf.text(currentX, currentY, [
                formatPostalCode(orderSet.orders[0].配送先の郵便番号),
                `${orderSet.orders[0].配送先の住所1} ${orderSet.orders[0].配送先の住所2}`,
                `${orderSet.orders[0].配送先の氏名} 様`
            ]);
            currentY += 10 + 3 * getLineHeight(pdf);
            pdf.text(currentX, currentY, 'この度は当ショップをご利用いただきありがとうございます。以下の通り納品させていただきます。');
            currentY += 5 + getLineHeight(pdf);
            pdf.text(currentX, currentY, [
                `注文番号：${orderSet.orderId}`,
                `お客様ID：${orderSet.orders[0].注文者のユーザーID}`,
                `ご注文日：${orderSet.orders[0].注文日}`
            ]);
            currentY += 5 + 3 * getLineHeight(pdf);
            pdf.text(currentX, currentY, '■ご注文商品■');
            currentY += getLineHeight(pdf);
            let total = 0;
            orderSet.orders.forEach(order => {
                const splitText = pdf.splitTextToSize(
                    `□個数：${order.数量}　${order.作品名}　単価：${order.販売価格}円　小計：${order.小計}円`,
                    170
                );
                pdf.text(currentX, currentY, splitText);
                currentY += splitText.length * getLineHeight(pdf);
                if (currentY > 277) {
                    pdf.addPage();
                    currentY = 20;
                }
                total += parseInt(order.小計, 10);
            });
            pdf.text(currentX, currentY, `合計金額：${total}円`)

            // Signature
            const signatureHeight = 5 + 7 * getLineHeight(pdf);
            if (currentY + 5 + signatureHeight > 277) {
                // If it doesn't fit in this page, add another page
                pdf.addPage();
            }
            currentY = 277 - signatureHeight;
            // The logo is a square so its length and height are equal to the signature height
            pdf.addImage(logo, 'JPEG', currentX, currentY, signatureHeight, signatureHeight);
            currentX += signatureHeight + 13; // Separate logo from text signature
            currentY += getLineHeight(pdf); // This is needed to line up signature text with logo
            pdf.text(currentX, currentY, [
                '〒723-0014',
                '広島県三原市城町1-9-2',
            ]);
            currentY += 5 + 2 * getLineHeight(pdf);
            pdf.text(currentX, currentY, [
                'minne店',
                '楽天市場店',
                '公式ホームページ',
                'インスタグラム',
            ]);
            currentX += 35;
            pdf.text(currentX, currentY, [
                'https://minne.com/@nano-koubou',
                'https://www.rakuten.ne.jp/gold/nanokoubou',
                'https://nano-koubou.shop',
                'https://www.instagram.com/nano.workshop',
            ]);
            currentX = 20;
            i++;
        });
        pdf.save();
    });
}

async function parseAndGenerate(generator) {
    const files = getFiles();
    if (files.length === 0) {
        alertAndThrow('注文一覧データのCSVファイルを選んでください');
    }
    const font = await (await fetch('yu-mincho-base64.txt')).text();
    // Configure PDF settings
    const pdf = new jsPDF({lineHeight: 1.5});
    pdf.addFileToVFS('yu-mincho-base64.txt', font)
    pdf.addFont('yu-mincho-base64.txt', 'yu-mincho', 'normal');
    pdf.setFont('yu-mincho');
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
    return Object.values(orderSets).sort((a, b) => b.orders[0].注文ID.localeCompare(a.orders[0].注文ID));
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

function getLineHeight(pdf) {
    return pdf.getLineHeight() / 2.835;
}
