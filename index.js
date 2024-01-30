const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const getAuthor = ($element) => {
    if($element.find('a').length === 2) {
            let author = $element.find('a:eq(0)').text();
            if($element.find('a:first').hasClass('bo3')) {
                author = $(element).next().find('a:eq(0)').text();
            }
            return author;
        } else {
            const authors = []
            for(let i=0; i<$element.find('a').length-1; i++){
                authors.push($element.find('a:eq('+i+')').text())
            }
            return authors.join(', ');
        }
}

async function crawlBooks(keyword, page) {
  try {
    const url = `https://www.aladin.co.kr/search/wsearchresult.aspx?SearchTarget=Book&KeyWord=${encodeURI(keyword)}&KeyRecentPublish=0&OutStock=0&ViewType=Detail&SortOrder=11&CustReviewCount=0&CustReviewRank=0&KeyFullWord=%EC%97%AD%EB%9D%BD&KeyLastWord=%EC%97%AD%EB%9D%BD&CategorySearch=&chkKeyTitle=&chkKeyAuthor=&chkKeyPublisher=&chkKeyISBN=&chkKeyTag=&chkKeyTOC=&chkKeySubject=&ViewRowCount=50&SuggestKeyWord=&page=${page}`;
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    const books = [];

    $('.ss_book_list:nth-child(1) > ul li:nth-child(1)').each((index, element) => {
        let bookName = $(element).find('a.bo3').text();
        if(!bookName) {
            bookName = $(element).next().find('a.bo3').text();
        }
        books.push({ bookName: bookName })
    });

    $('.ss_book_list:nth-child(1) > ul li:nth-child(2)').each((index, element) => {
        if($(element).find('a:first').hasClass('bo3')) {
            books[index].author = getAuthor($(element).next())
        } else {
            books[index].author = getAuthor($(element))
        }
    });

    $('.ss_book_list:nth-child(1) > ul li:nth-child(3)').each((index, element) => {
        const price = $(element).find('span:first').text()
        if(!price) {
            books[index].price = $(element).next().find('span:first').text()
        } else {
            books[index].price = price
        }
    });

    $('.ss_book_box').each((index, element) => {
        const itemId = $(element).attr('itemid')
        if(itemId) {
            books[index].itemId = itemId
        }
    });
    return books;
  } catch (error) {
    console.error('에러 발생:', error.message);
  }
}

async function crawlBookDetails(books) {
    for(let book of books) {
        console.log("book detail start : "+book.itemId)
        const url = `https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=${book.itemId}`;
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);
        $('meta').each((index, element) => {
            if($(element).attr('itemprop') === 'datePublished') {
                book.datePublished = $(element).attr('content')
            }
        })

        $('.conts_info_list1 ul > li:nth-last-child(1)').each((index, element) => {
            book.isbn = $(element).text().replace('ISBN : ', '')
        })

        await sleep(250);
    }
    return books;
}

const main = async (keyword, maxPage) => {
    const result = []
    keyword = keyword.trim()
    maxPage = Number(maxPage)

    for(let i=1; i<=maxPage; i++) {
        console.log(`current page: ${i}, max page: ${maxPage}`)
        const books = await crawlBooks(i);
        await sleep(250);

        const booksWithDetail = await crawlBookDetails(books)

        result.push(booksWithDetail.map((book, index) => {
            return book.bookName + " / " + book.author + " / " + book.price  + " / " + book.datePublished + " / " + book.isbn
        })
        .join('\n'))

        await sleep(250);
        
    }
    fs.writeFileSync('result.txt', result.join('\n'))    
}

const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const keyword = process.argv[2]
const page = process.argv[3]

main(keyword, page);