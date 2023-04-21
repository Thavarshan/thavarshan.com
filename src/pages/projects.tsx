import {
    Badge,
    Box,
    Container,
    Divider,
    Flex,
    GridItem,
    Heading,
    HStack,
    Link,
    SimpleGrid,
    Spacer,
    Stack,
    Tag,
    Text
} from '@chakra-ui/react';
import Head from 'next/head';
import Image from 'next/image';
import photo from '@/assets/images/jerome.jpg';
import { FaLinkedin, FaBitbucket, FaGithub, FaPaperPlane } from 'react-icons/fa';
import { CgFileDocument } from 'react-icons/cg';
import axios from 'axios';
import { Octokit } from 'octokit';
import moment from 'moment';
import SimpleBar from 'simplebar-react';
import { NextSeo } from 'next-seo';

const Home = ({ personal, practice }: any) => {
    return (
        <>
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

            <Box>
                <Box>
                    <Box mb='10'>
                        <Heading as='h3' color='white' size='lg'>Practice Projects</Heading>

                        <Text mt='4' color='gray.500' maxW='md'>
                            All projects that are random ideas, opensource contributions, and other projects that I&apos;m working on.
                        </Text>
                    </Box>

                    <SimpleGrid columns={12} spacing={6}>
                        {personal.map((project: any) => (
                            <GridItem colSpan={4} key={project.id}>
                                <Flex direction='column' minH={'200px'} maxW='md' className='bg-gray-900 border border-gray-700 rounded-xl p-4'>
                                    <Box>
                                        <Heading as='h5' color='white' size='sm'>{project.name}</Heading>

                                        <Link href={project.website ? project.website : (project.html_url || project.links.html.href)} isExternal>
                                            <Text mt={1} as='h6' color='white' fontSize='xs'>{project.full_name}</Text>
                                        </Link>

                                        <Text mt={3} fontSize='sm' maxW='sm' color='gray.500' className='truncate ...'>
                                            {project.description}
                                        </Text>
                                    </Box>

                                    <Spacer />

                                    <Stack mt={4} direction='row' spacing='3'>
                                        <Badge rounded='md'>{(project.language || 'Markdown').toLowerCase()}</Badge>

                                        <Box fontSize='xs' color='gray.500'>Last updated {moment(project.updated_at).fromNow()}</Box>
                                    </Stack>
                                </Flex>
                            </GridItem>
                        ))}
                    </SimpleGrid>
                </Box>

                <div className='border-b border-gray-700 mt-16 mb-12'></div>

                <Box>
                    <Box mb='10'>
                        <Heading as='h3' color='white' size='lg'>Practice Projects</Heading>

                        <Text mt='4' color='gray.500' maxW='md'>
                            All projects that were created for practice, learning, and/or testing.
                        </Text>
                    </Box>

                    <SimpleGrid columns={12} spacing={6}>
                        {practice.map((project: any) => (
                            <GridItem colSpan={4} key={project.id}>
                                <Flex direction='column' minH={'200px'} maxW='md' className='bg-gray-900 border border-gray-700 rounded-xl p-4'>
                                    <Box>
                                        <Heading as='h5' color='white' size='sm'>{project.name}</Heading>

                                        <Link href={project.website ? project.website : (project.html_url || project.links.html.href)} isExternal>
                                            <Text mt={1} as='h6' color='white' fontSize='xs'>{project.full_name}</Text>
                                        </Link>

                                        <Text mt={3} fontSize='sm' maxW='sm' color='gray.500' className='truncate ...'>
                                            {project.description}
                                        </Text>
                                    </Box>

                                    <Spacer />

                                    <Flex mt={4} align='center'>
                                        <Badge rounded='md'>{(project.language || 'Markdown').toLowerCase()}</Badge>

                                        <Spacer />

                                        <Box fontSize='xs' color='gray.500'>Last updated {moment(project.updated_at || project.updated_on).fromNow()}</Box>
                                    </Flex>
                                </Flex>
                            </GridItem>
                        ))}
                    </SimpleGrid>
                </Box>
            </Box>
        </>
    );
};

export async function getStaticProps () {
    const octokit = new Octokit({ auth: process.env.NEXT_PUBLIC_GITHUB_API_KEY });
    const { data: personal } = await octokit.request('GET /users/{owner}/repos', {
        owner: process.env.NEXT_PUBLIC_GITHUB_REPO_OWNER,
        headers: {
            'X-GitHub-Api-Version': process.env.NEXT_PUBLIC_GITHUB_API_VERSION
        }
    });

    const { data: { values: practice } } = await axios.get('https://api.bitbucket.org/2.0/repositories/thavarshan?pagelen=100');

    return { props: { personal, practice } };
}

export default Home;
