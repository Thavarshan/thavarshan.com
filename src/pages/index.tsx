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

const Home = ({ projects }: any) => {
    return (
        <>
            <Head>
                <title>Jerome Thayananthajothy</title>
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <Container maxW='container.lg' py='20'>
                <Box>
                    <SimpleGrid columns={{ base: 1, lg: 12 }} spacing={6}>
                        <GridItem colSpan={7}>
                            <Stack spacing={6}>
                                <Heading as='h3' color='white' size='lg'>Jerome <span className='font-light'>Thayananthajothy</span></Heading>

                                <Text color='gray.400' maxW={{ base: 'full', md: 'xl', xl: 'lg' }}>
                                    Hey, I&apos;m Jerome. I&apos;m a professional Software Engineer, Graphic design enthusiate, and part-time Artist. I love to create, make, and build stuff. I spend countless hours sitting in front of a computer screen making something amazing and when I&apos;m not, I draw pencil sketch portraits.
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
                                    Althought I specialize in PHP & TypeScript, I do have mid-level experience with C++, Java and Python. I am now working on broadening my horizon by exploring Machine Learning, Rust and Golang.
                                </Text>
                            </Stack>
                        </GridItem>

                        <GridItem colSpan={5}>
                            <SimpleBar style={{ maxHeight: '710px' }} autoHide>
                                {projects.map((project: any) => (
                                    <Box key={project.id} border='1px' className='bg-gray-900 border border-gray-800 mb-4' rounded='xl' p={4}>
                                        <Heading as='h5' color='white' size='sm'>{project.name}</Heading>

                                        <Link href={project.website ? project.website : (project.html_url || project.links.html.href)} isExternal>
                                            <Text mt={1} as='h6' color='white' fontSize='xs'>{project.full_name}</Text>
                                        </Link>

                                        <Text mt={3} fontSize='sm' maxW='sm' color='gray.500'>
                                            {project.description}
                                        </Text>

                                        <HStack mt={4} spacing={4}>
                                            <Badge rounded='md'>{(project.language || 'Markdown').toLowerCase()}</Badge>

                                            <Box fontSize='xs' color='gray.400'>Last updated {moment(project.updated_at).fromNow()}</Box>
                                        </HStack>
                                    </Box>
                                ))}
                            </SimpleBar>
                        </GridItem>
                    </SimpleGrid>
                </Box>
            </Container>
        </>
    );
};

export async function getStaticProps () {
    const octokit = new Octokit({ auth: process.env.NEXT_PUBLIC_GITHUB_API_KEY });
    const { data } = await octokit.request('GET /users/{owner}/repos?type=public', {
        owner: process.env.NEXT_PUBLIC_GITHUB_REPO_OWNER,
        headers: {
            'X-GitHub-Api-Version': process.env.NEXT_PUBLIC_GITHUB_API_VERSION
        }
    });

    return { props: { projects: data } };
}

export default Home;
