#!/usr/bin/env node
import inquirer from 'inquirer';
import fs from 'fs';
import { 
    getBestPlaceToWork, getAllReviews, 
    getShortReview, createReviewUrl, 
    getOverview, page
} from './scraper.js';


const saveToJson = (name, obj) => {
    fs.writeFile(`./${name}.json`, JSON.stringify(obj, null, 4), (err) => {
        if (err) {
          console.error(err.message);
          return;
        }
        console.log(`Data written to ${name}.json`);
    });
}

const run = async () => {
  while (true) {
    const { choice } = await inquirer.prompt([
        {
            type: 'list',
            name: 'choice',
            message: 'What do you want to do?',
            choices: [
                { name: 'Get Best Place To Work', value: 'bptw' },
                { name: 'Get Reviews', value: 'review' },
                { name: 'Get Overview', value: 'overview' },
                { name: 'Exit', value: 'exit' },
            ],
        },
    ]);

    if (choice === 'bptw') {
        const { year } = await inquirer.prompt([
            {
                type: 'input',
                name: 'year',
                message: 'Enter year:',
            }
        ]);
        saveToJson('bptw', await getBestPlaceToWork(year))
    } else if (choice === 'review') {
        const { url, pageNumber } = await inquirer.prompt([
            {
                type: 'input',
                name: 'url',
                message: 'Enter url:'
            },
            {
                type: 'input',
                name: 'pageNumber',
                message: 'Enter number of pages:'
            }
        ]);
        const allReviews = {
            reviews: []
        };
        for (let i = 1; i < Number(pageNumber) + 1; i++) {
            console.time('Get 10 reviews for')
            // waitUntil:"domcontentloaded"
            // https://www.glassdoor.com/Reviews/Target-Reviews-E194.htm
            await page.goto(
                createReviewUrl(url, i), {timeout:0, waitUntil:"domcontentloaded"}
            )
            .then(() => window.stop())
            .catch((e) => void e);

            const reviews = await getAllReviews(i);
            // console.log(typeof(reviews));
            const shortReviews = await getShortReview(reviews);
            allReviews.reviews.push(...shortReviews)
            console.timeEnd('Get 10 reviews for')
        }
        saveToJson('reviews', allReviews)
    } else if (choice === 'overview') {
        const { url } = await inquirer.prompt([
            {
                type: 'input',
                name: 'url',
                message: 'Enter url:',
            }
        ]);
        try {
            await page.goto(url, {timeout: 0});
        } catch (error) {
            if (error) {
                console.log(error.message);
            }
        }
        saveToJson('overview', await getOverview())
    } else if (choice === 'exit') {
        console.log('Exiting...');
        process.exit();
    }
  }
};

run();
