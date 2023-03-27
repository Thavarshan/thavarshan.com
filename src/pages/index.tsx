import {
    Badge,
    Box,
    Container,
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

            <Container maxW='container.xl' py={{ base: 6, md: 12 }}>
                <Box>
                    <SimpleGrid columns={{ base: 1, lg: 12 }} spacing={6}>
                        <GridItem colSpan={{ base: 1, md: 5, lg: 6 }}>
                            <Stack spacing={6}>
                                <Heading as='h3' color='white' size='lg'>Jerome <span className='font-light'>Thayananthajothy</span></Heading>

                                <Text color='gray.400' maxW={{ base: 'full', md: 'xl', xl: 'lg' }}>
                                    Hey, I&apos;m Jerome. I&apos;m a professional Software Engineer, Graphic design enthusiast, and part-time Artist. I&apos;m passionate about taking everyday problems and building creative solutions. I take pride in spending countless hours perfecting and honing my craft and making something unique, but when I&apos;m away from the computer, I like to draw traditional pencil sketch portraits.
                                </Text>

                                <Flex align='start'>
                                    <Image alt='Jerome' className='rounded-full grayscale' src={photo.src} width={100} height={100} priority />

                                    <Stack spacing={2} ml='6' my='auto'>
                                        <Link href='https://www.linkedin.com/in/thavarshan/' color='white' isExternal display='flex' className='items-center'>
                                            <HStack spacing={2}>
                                                <FaLinkedin />
                                                <Text>Linkedin Profile</Text>
                                            </HStack>
                                        </Link>

                                        <Link href='https://github.com/Thavarshan/' color='white' isExternal display='flex' className='items-center'>
                                            <HStack spacing={2}>
                                                <FaGithub />
                                                <Text>Github Projects</Text>
                                            </HStack>
                                        </Link>

                                        <Link href='https://bitbucket.org/thavarshan/' color='white' isExternal display='flex' className='items-center'>
                                            <HStack spacing={2}>
                                                <FaBitbucket />
                                                <Text>Bitbucket Projects</Text>
                                            </HStack>
                                        </Link>

                                        <Link href='mailto:tjthavarshan@gmail.com' color='white' isExternal display='flex' className='items-center'>
                                            <HStack spacing={2}>
                                                <FaPaperPlane />
                                                <Text>Get in touch</Text>
                                            </HStack>
                                        </Link>

                                        <Link href='/docs/Jerome_Thayananthajothy_CV.pdf' color='white' isExternal display='flex' className='items-center'>
                                            <HStack spacing={2}>
                                                <CgFileDocument />
                                                <Text>Résumé</Text>
                                            </HStack>
                                        </Link>
                                    </Stack>
                                </Flex>

                                <Text color='gray.400' maxW={{ base: 'full', md: 'xl', xl: 'lg' }}>
                                    Although I specialize in PHP & TypeScript, I do have mid-level experience with C++, Java, and Python. I am now working on broadening my horizon by exploring Machine Learning, Rust, and Golang.
                                </Text>
                            </Stack>
                        </GridItem>

                        <GridItem colSpan={{ base: 1, md: 7, lg: 6 }}>
                            <SimpleGrid columns={{ base: 1, md: 12 }} spacing={6}>
                                <GridItem mt={{ base: 6, md: 0 }} colSpan={{ base: 1, md: 6 }}>
                                    <Box mb='6'>
                                        <Heading as='h6' size='xs' color='white' textTransform='uppercase'>
                                            Personal Projects
                                        </Heading>
                                    </Box>

                                    <SimpleBar style={{ maxHeight: '710px' }} autoHide>
                                        {personal.map((project: any) => (
                                            <Flex direction='column' minH={'180px'} key={project.id} border='1px' className='bg-gray-900 border border-gray-800 mb-4' rounded='xl' p={4}>
                                                <Box>
                                                    <Heading as='h5' color='white' size='sm'>{project.name}</Heading>

                                                    <Link href={project.website ? project.website : (project.html_url || project.links.html.href)} isExternal>
                                                        <Text mt={1} as='h6' color='white' fontSize='xs'>{project.full_name}</Text>
                                                    </Link>

                                                    <Text mt={3} fontSize='sm' maxW='sm' color='gray.500'>
                                                        {project.description}
                                                    </Text>
                                                </Box>

                                                <Spacer />

                                                <Flex mt={4} align='center'>
                                                    <Badge rounded='md'>{(project.language || 'Markdown').toLowerCase()}</Badge>

                                                    <Spacer />

                                                    <Box fontSize='xs' color='gray.400'>Last updated {moment(project.updated_at).fromNow()}</Box>
                                                </Flex>
                                            </Flex>
                                        ))}
                                    </SimpleBar>
                                </GridItem>

                                <GridItem mt={{ base: 6, md: 0 }} colSpan={{ base: 1, md: 6 }}>
                                    <Box mb='6'>
                                        <Heading as='h6' size='xs' color='white' textTransform='uppercase'>
                                            Practice Projects
                                        </Heading>
                                    </Box>

                                    <SimpleBar style={{ maxHeight: '710px' }} autoHide>
                                        {practice.map((project: any) => (
                                            <Flex direction='column' minH={'180px'} key={project.id} border='1px' className='bg-gray-900 border border-gray-800 mb-4' rounded='xl' p={4}>
                                                <Box>
                                                    <Heading as='h5' color='white' size='sm'>{project.name}</Heading>

                                                    <Link href={project.website ? project.website : (project.html_url || project.links.html.href)} isExternal>
                                                        <Text mt={1} as='h6' color='white' fontSize='xs'>{project.full_name}</Text>
                                                    </Link>

                                                    <Text mt={3} fontSize='sm' maxW='sm' color='gray.500'>
                                                        {project.description}
                                                    </Text>
                                                </Box>

                                                <Spacer />

                                                <Flex mt={4} align='center'>
                                                    <Badge rounded='md'>{(project.language || 'Markdown').toLowerCase()}</Badge>

                                                    <Spacer />

                                                    <Box fontSize='xs' color='gray.400'>Last updated {moment(project.updated_at || project.updated_on).fromNow()}</Box>
                                                </Flex>
                                            </Flex>
                                        ))}
                                    </SimpleBar>
                                </GridItem>
                            </SimpleGrid>
                        </GridItem>
                    </SimpleGrid>
                </Box>
            </Container>
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
