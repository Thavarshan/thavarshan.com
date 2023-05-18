import { NextSeo } from 'next-seo';

const SEO = () => {
    return <>
        <NextSeo
            title='Jerome Thayananthajothy'
            description='Jerome Thayananthajothy | Personal Portfolio'
            openGraph={{
                url: 'https://www.thavarshan.xyz',
                title: 'Jerome Thayananthajothy',
                description: 'Jerome Thayananthajothy | Personal Portfolio',
                images: [
                    { url: 'https://www.thavarshan.xyz/images/jerome.jpg' }
                ],
                siteName: 'Jerome Thayananthajothy',
            }} />
    </>;
};

export default SEO;
