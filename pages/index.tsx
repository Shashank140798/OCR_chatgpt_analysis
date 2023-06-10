import { useEffect, useRef, useState } from 'react';
import { Group, Stack, Text, Image, Progress, Button, TextInput } from '@mantine/core';
import { Dropzone, IMAGE_MIME_TYPE } from '@mantine/dropzone';
import { createWorker } from 'tesseract.js';
import axios from 'axios';

const Home = () => {
  const [imageData, setImageData] = useState<null | string>(null);
  const [isChatting, setIsChatting] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [chatHistory, setChatHistory] = useState([{ role: 'system', content: 'ChatGPT Analysis' }]);
  const loadFile = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const imageDataUri = reader.result;
      setImageData(imageDataUri as string);
    };
    reader.readAsDataURL(file);
  };

  const callOpenAI = async (prompt: string) => {
    const apiKey = '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';
    const endpoint = 'https://api.openai.com/v1/engines/davinci/completions';

    try {
      const response = await axios.post(
        endpoint,
        {
          prompt: prompt,
          max_tokens: 500,
          temperature: 0.4,
          n: 1
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.choices[0].text.trim();
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      return null;
    }
  };

  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('idle');
  const [ocrResult, setOcrResult] = useState('');

  const workerRef = useRef<Tesseract.Worker | null>(null);
  useEffect(() => {
    workerRef.current = createWorker({
      logger: message => {
        if ('progress' in message) {
          setProgress(message.progress);
          setProgressLabel(message.progress === 1 ? 'Done' : message.status);
        }
      }
    });
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const handleExtract = async () => {
    setProgress(0);
    setProgressLabel('starting');

    const worker = workerRef.current!;
    await worker.load();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');

    const response = await worker.recognize(imageData!);
    const ocrText = response.data.text;

    setOcrResult(ocrText);

    setIsChatting(true);
    const conversation = [
      ...chatHistory,
      { role: 'user', content: ocrText }
    ];

    try {
      const chatResponse = await callOpenAI(
        conversation.map(item => item.content).join('\n')
      );
      setChatHistory([
        ...conversation,
        { role: 'assistant', content: chatResponse }
      ]);
    } catch (error) {
      console.error('Error processing chat with OpenAI:', error);
    }

    setIsChatting(false);
  };

  const handleChat = async () => {
    if (userInput.trim() === '') {
      return;
    }
  
    setIsChatting(true);
  
    try {
      const chatResponse = await callOpenAI(userInput);
      setChatHistory([
        ...chatHistory,
        { role: 'user', content: userInput },
        { role: 'assistant', content: chatResponse }
      ]);
    } catch (error) {
      console.error('Error processing chat with OpenAI:', error);
    }
  };

    

  return (
    <>
      <Group align='initial' style={{ padding: '10px' }}>
        <Stack style={{ flex: '1' }}>
          <Dropzone
            onDrop={(files) => loadFile(files[0])}
            accept={IMAGE_MIME_TYPE}
            multiple={false}
          >
            {() => (
              <Text size='xl' inline>
                Drag image here or click to select file
              </Text>
            )}
          </Dropzone>

          {!!imageData && <Image src={imageData} style={{ width: '100%' }} />}
        </Stack>

        <Stack style={{ flex: '1' }}>
          <Button disabled={!imageData || !workerRef.current} onClick={handleExtract}>
            Extract
          </Button>
          <Text>{progressLabel.toUpperCase()}</Text>
          <Progress value={progress * 100} />

          {!!ocrResult && (
            <Stack>
              <Text size='xl'>OCR RESULT</Text>
              <Text style={{ fontFamily: 'monospace', background: 'black', padding: '10px' }}>
                {ocrResult}
              </Text>
            </Stack>
          )}
        </Stack>
      </Group>

      <Group align='initial' style={{ padding: '10px' }}>
        <Stack style={{ flex: '1' }}>
          {chatHistory.map((message, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                justifyContent: message.role === 'assistant' ? 'flex-end' : 'flex-start',
                marginBottom: '10px'
              }}
            >
              {message.role === 'assistant' ? (
                <Text style={{ fontFamily: 'monospace', background: 'black', padding: '10px' }}>
                  {message.content}
                </Text>
              ) : (
                <Text>{message.content}</Text>
              )}
            </div>
          ))}
        </Stack>

        
      </Group>
    </>
  );
};

export default Home;
