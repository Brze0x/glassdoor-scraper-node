import { chromium } from 'playwright';


export const browser = await chromium.launch({headless: true});
export const page = await browser.newPage();

export const getOverview = async () => {
    return await page.evaluate(() => {
        let employerId;
        const appVersion = window.appCache.appVersion;
        if (appVersion === '2.4.13') {
            employerId = window.appCache.initialState.parsedRequest.params.employerId
        } else {
            employerId = window.appCache.initialState.employerId;
        }
    
        return [
            {
                "id": window.appCache.apolloState[`Employer:${employerId}`].id,
                "shortName": window.appCache.apolloState[`Employer:${employerId}`].shortName,
                "reviewsUrl": window.appCache.apolloState[`Employer:${employerId}`].links.reviewsUrl,
                "website": window.appCache.apolloState[`Employer:${employerId}`].website,
                "type": window.appCache.apolloState[`Employer:${employerId}`].type,
                "revenue": window.appCache.apolloState[`Employer:${employerId}`].revenue,
                "headquarters": window.appCache.apolloState[`Employer:${employerId}`].headquarters,
                "size": window.appCache.apolloState[`Employer:${employerId}`].size,
                "stock": window.appCache.apolloState[`Employer:${employerId}`].stock,
                "yearFounded": window.appCache.apolloState[`Employer:${employerId}`].yearFounded,
                "industryName": window.appCache.apolloState[`Employer:${employerId}`].primaryIndustry.industryName,
                "description": window.appCache.apolloState[`Employer:${employerId}`].overview.description,
                "mission": window.appCache.apolloState[`Employer:${employerId}`].overview.mission
            },
            appVersion
        ]
    });
}

export const getAllReviews = async (pageNum) => {
    return await page.evaluate((pageNum) => {
        try {
            // const appVersion = window.appCache.appVersion;
            const employerReviewsObj = (pageNum) => {
                return {
                    "applyDefaultCriteria": true,
                    "division": null,
                    "dynamicProfileId": window.appCache.initialState.profileId,
                    "employer": {"id": window.appCache.initialState.employerId},
                    "employmentStatuses": [],
                    "goc": null,
                    "highlight": null,
                    "jobTitle": null,
                    "language": "eng",
                    "location": {"cityId": null, "countryId": null, "metroId": null, "stateId": null},
                    "onlyCurrentEmployees": false,
                    "page": {"num": pageNum, "size": 10},
                    "preferredTldId": 0,
                    "sort": "RELEVANCE",
                    "worldwideFilter": false
                }
            };
            const employerReviews = `employerReviews(${JSON.stringify(employerReviewsObj(pageNum))})`;
            const reviews = window.appCache.apolloState.ROOT_QUERY[employerReviews].reviews;
            return reviews;
        } catch (error) {
            console.log(error.message);
        }
    }, pageNum);
}

const getJobTitles = async (employerId) => {
    return await page.evaluate((id) => {
        return window.appCache.apolloState.ROOT_QUERY[`jobTitlesByEmployer({"employerId":${id}})`];
    }, employerId);
}

const getCityById = async (cityId) => {
    return await page.evaluate((id) => {
        return window.appCache.apolloState[`City:${id}`].name;
    }, cityId)
} 

const getJobTitleById = (jobTitles, jobTitleId) => {
    const jobTitle = jobTitles.find(jobTitle => jobTitle.jobTitleId == jobTitleId);
    return jobTitle ? jobTitle.jobTitle : "Job Title not found";
}

const convertDate = (data) => {
    let date = new Date(data);
    return date.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'});
}

export const getShortReview = async (reviews) => {
    return Promise.all(
        reviews.map(
            async (review) => {
                const employerId = review.employer ? review.employer.__ref.split(':')[1] : null;
                const jobTitleId = review.jobTitle ? review.jobTitle.__ref.split(':')[1] : null;
                const cityId = review.location ? review.location.__ref.split(':')[1] : null;
                const jobTitles = !employerId ? null : await getJobTitles(employerId);
                const jobTitle = !jobTitleId || !jobTitles ? null : getJobTitleById(jobTitles, jobTitleId);
                const location = cityId ? await getCityById(cityId) : null;
                return {
                    "reviewId": review.reviewId,
                    "date": convertDate(review.reviewDateTime),
                    "jobTitle": jobTitle,
                    "location": location,
                    "rating": review.ratingOverall,
                    "employeeSituation": getEmployeeSituation(review),
                    "lengthOfEmployment": review.lengthOfEmployment,
                    "summary": review.summary,
                    "pros": review.pros,
                    "cons": review.cons,
                    "adviceToManagement": review.advice
                }
            }
        )
    );
}

export const createReviewUrl = (link, pageNumber) => {
    return `${link.slice(0, link.lastIndexOf('.'))}_P${pageNumber}.${link.slice(link.lastIndexOf('.') + 1)}`;
}

const getEmployeeSituation = (review) => {
    let jobStatus = review.isCurrentJob ? "Current" : "Former";
    let jobType = review.employmentStatus;
    switch (jobType) {
        case "REGULAR":
            return `${jobStatus} Employee`;
        case "INTERN":
            return `${jobStatus} Intern`;
        case "CONTRACT":
            return `${jobStatus} Contractor`;
        case "PART_TIME":
            return `${jobStatus} Employee - Part-time`;
        case "FREELANCE":
            return `${jobStatus} Freelancer`;
        default:
            return "Employment status not found";
    }
}

const getAwardDetailUrl = (year) => {
    const currentYear = new Date().getFullYear();
    year = Number(year);
    if (year > currentYear || year < 2009 || !year) {
        return null;
    }
    const url = year === currentYear 
    ? `https://www.glassdoor.com/Award/Best-Places-to-Work-LST_KQ0,19.htm` 
    : `https://www.glassdoor.com/Award/Best-Places-to-Work-${year}-LST_KQ0,24.htm`;

    return url;
}

const getAwardDetail = async (url, year) => {
    await page.goto(url);
    return await page.evaluate((year) => {
        year = !year ? '' : year + ' ';
        const awardDetailKey = `awardDetail({"awardName":"Best Places to Work ${year}"})`;
        return window.appCache.apolloState.ROOT_QUERY[awardDetailKey].__ref;
    }, year)
}

const getAwardDetailRange = async (year) => {
    const currentYear = new Date().getFullYear();
    year = Number(year);
    const url = getAwardDetailUrl(year);
    if (url && year === currentYear) {
        const res = await getAwardDetail(url, '');
        const range = res.split(':').slice(1).join(':').replace(':', '-')
        return { range: range, year: year };
    }
    if (url && year >= 2009 && year < currentYear) {
        const res = await getAwardDetail(url, year);
        const range = res.split(':').slice(1).join(':').replace(':', '-')
        return { range: range, year: year };
    }
    return { range: null, year: year };
}

const getBestPlaceToWorkItems = async (data) => {
    if (!data.range) {
        return null;
    }
    return await page.evaluate((data) => {
        const items = window.appCache.apolloState[data.range].items;
        items.forEach(el => {
            el.year = data.year
        })
        return items;
    }, data)
}

export const getBestPlaceToWork = async (year) => {
    const data = await getAwardDetailRange(year);
    const items = await getBestPlaceToWorkItems(data);
    if (!items) {
        return null;
    }
    return Promise.all(
        items.map(
            async (item) => {
                return await page.evaluate((item) => {
                    const rawReview = window.appCache.apolloState[item.__ref];
                    const employer = window.appCache.apolloState[rawReview.employer.__ref];
                    return {
                        "year": item.year,
                        "employer": employer.shortName,
                        "reviewId": rawReview.id,
                        "reviewSnippet": rawReview.featuredReviewSnippet,
                        "rank": rawReview.listRank,
                        "rating": rawReview.rating
                    }
                }, item)
            }
        )
    )
}
